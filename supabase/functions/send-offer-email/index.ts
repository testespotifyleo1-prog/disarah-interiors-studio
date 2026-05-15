import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildOfferEmail,
  buildBrandFromStoreAndAccount,
  sendViaResend,
} from "../_shared/email-template.ts";

const corsHead = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  campaign_id: string;
  recipient_emails?: string[]; // optional override (manual test)
  store_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHead });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    if (!jwt) return json({ error: "missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = (await req.json()) as ReqBody;
    if (!body?.campaign_id) return json({ error: "campaign_id required" }, 400);

    // Load campaign
    const { data: campaign, error: cErr } = await admin
      .from("email_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
    if (cErr || !campaign) return json({ error: "campaign not found" }, 404);

    // Membership check
    const { data: isMember } = await admin.rpc("has_account_role", {
      _user_id: user.id,
      _account_id: campaign.account_id,
      _roles: ["owner", "admin", "manager"],
    });
    if (!isMember) return json({ error: "forbidden" }, 403);

    // Resolve store + account for branding
    const storeId = body.store_id || campaign.store_id;
    const [{ data: store }, { data: account }] = await Promise.all([
      storeId
        ? admin.from("stores").select("*").eq("id", storeId).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("accounts").select("id,name").eq("id", campaign.account_id).maybeSingle(),
    ]);

    const brand = buildBrandFromStoreAndAccount(store, account, SUPABASE_URL);
    if (!store?.logo_path) {
      console.log("[send-offer-email] No logo for store — recommending upload");
    }

    // Build recipient list
    let recipients: Array<{ email: string; name: string | null; id: string | null }> = [];

    if (body.recipient_emails?.length) {
      recipients = body.recipient_emails
        .filter((e) => e && e.includes("@"))
        .map((e) => ({ email: e.trim().toLowerCase(), name: null, id: null }));
    } else {
      // Audience-based: load customers with email
      const audience = campaign.audience || "all_customers";
      let q = admin.from("customers")
        .select("id,name,email")
        .eq("account_id", campaign.account_id)
        .not("email", "is", null);

      if (audience === "credit_authorized") q = q.eq("credit_authorized", true);

      const { data: customers, error: custErr } = await q;
      if (custErr) return json({ error: custErr.message }, 500);

      recipients = (customers || [])
        .filter((c: any) => c.email && c.email.includes("@"))
        .map((c: any) => ({
          email: c.email.trim().toLowerCase(),
          name: c.name,
          id: c.id,
        }));
    }

    // Dedupe by email
    const seen = new Set<string>();
    recipients = recipients.filter((r) => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

    if (recipients.length === 0) {
      return json({ ok: true, sent: 0, skipped: 0, message: "Nenhum cliente com email cadastrado" });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send sequentially to respect rate limits (small batches OK for typical store sizes)
    for (const r of recipients) {
      const html = buildOfferEmail({
        brand,
        customerName: r.name,
        headline: campaign.headline,
        body: campaign.body,
        imageUrl: campaign.image_url,
        highlightPrice: campaign.highlight_price,
        highlightOldPrice: campaign.highlight_old_price,
        ctaLabel: campaign.cta_label,
        ctaUrl: campaign.cta_url,
      });

      const result = await sendViaResend({
        to: r.email,
        subject: campaign.subject,
        html,
        fromName: brand.storeName,
      });

      await admin.from("email_send_logs").insert({
        account_id: campaign.account_id,
        campaign_id: campaign.id,
        customer_id: r.id,
        recipient_email: r.email,
        subject: campaign.subject,
        kind: "offer",
        status: result.ok ? "sent" : "failed",
        error: result.error || null,
        resend_id: result.id || null,
        sent_by: user.id,
      });

      if (result.ok) sent++;
      else {
        failed++;
        if (errors.length < 3) errors.push(result.error || "unknown");
      }
    }

    await admin.from("email_campaigns")
      .update({
        total_sent: (campaign.total_sent || 0) + sent,
        last_sent_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    return json({
      ok: true,
      sent,
      failed,
      total: recipients.length,
      logo_missing: !store?.logo_path,
      errors: errors.slice(0, 3),
    });
  } catch (e) {
    console.error("send-offer-email error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHead, "Content-Type": "application/json" },
  });
}
