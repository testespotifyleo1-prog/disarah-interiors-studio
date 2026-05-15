import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildFiscalEmail,
  buildBrandFromStoreAndAccount,
  sendViaResend,
} from "../_shared/email-template.ts";

const corsHead = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  fiscal_document_id: string;
  override_email?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHead });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader) return json({ error: "missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = (await req.json()) as ReqBody;
    if (!body?.fiscal_document_id) return json({ error: "fiscal_document_id required" }, 400);

    // Load fiscal doc + sale + customer + store
    const { data: doc, error: dErr } = await admin
      .from("fiscal_documents")
      .select("id,sale_id,store_id,type,status,pdf_url,xml_url,access_key,nfe_number")
      .eq("id", body.fiscal_document_id)
      .maybeSingle();
    if (dErr || !doc) return json({ error: "fiscal document not found" }, 404);

    if (doc.status !== "issued") {
      return json({ error: "Documento não está autorizado para envio" }, 400);
    }

    const [{ data: sale }, { data: store }] = await Promise.all([
      admin.from("sales")
        .select("id,total,order_number,account_id,customer_id,customers(id,name,email)")
        .eq("id", doc.sale_id).maybeSingle(),
      admin.from("stores").select("*").eq("id", doc.store_id).maybeSingle(),
    ]);
    if (!sale) return json({ error: "sale not found" }, 404);

    // Membership check
    const { data: isMember } = await admin.rpc("is_account_member", {
      _user_id: user.id,
      _account_id: sale.account_id,
    });
    if (!isMember) return json({ error: "forbidden" }, 403);

    const recipientEmail = body.override_email || (sale as any)?.customers?.email;
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return json({ error: "Cliente sem email cadastrado" }, 400);
    }

    const { data: account } = await admin.from("accounts").select("id,name").eq("id", sale.account_id).maybeSingle();
    const brand = buildBrandFromStoreAndAccount(store, account, SUPABASE_URL);

    const totalFmt = sale.total
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(sale.total))
      : null;

    // Build a public download URL via the existing download-fiscal-file function
    const downloadBase = `${SUPABASE_URL}/functions/v1/download-fiscal-file`;
    const pdfLink = `${downloadBase}?doc_id=${doc.id}&format=pdf`;
    const xmlLink = `${downloadBase}?doc_id=${doc.id}&format=xml`;

    const docTypeLabel = (doc.type as string)?.toUpperCase() === "NFCE" ? "NFC-e" : "NFe";

    const html = buildFiscalEmail({
      brand,
      customerName: (sale as any)?.customers?.name || null,
      documentType: docTypeLabel as "NFe" | "NFC-e",
      saleNumber: sale.order_number,
      total: totalFmt,
      pdfUrl: doc.pdf_url || pdfLink,
      xmlUrl: doc.xml_url || xmlLink,
      accessKey: doc.access_key,
    });

    const result = await sendViaResend({
      to: recipientEmail,
      subject: `Sua ${docTypeLabel} - ${brand.storeName}`,
      html,
      fromName: brand.storeName,
    });

    await admin.from("email_send_logs").insert({
      account_id: sale.account_id,
      sale_id: sale.id,
      customer_id: (sale as any)?.customers?.id || null,
      recipient_email: recipientEmail,
      subject: `Sua ${docTypeLabel} - ${brand.storeName}`,
      kind: "fiscal",
      status: result.ok ? "sent" : "failed",
      error: result.error || null,
      resend_id: result.id || null,
      sent_by: user.id,
    });

    if (!result.ok) return json({ error: result.error || "Falha ao enviar" }, 500);
    return json({ ok: true, recipient: recipientEmail });
  } catch (e) {
    console.error("send-fiscal-email error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHead, "Content-Type": "application/json" },
  });
}
