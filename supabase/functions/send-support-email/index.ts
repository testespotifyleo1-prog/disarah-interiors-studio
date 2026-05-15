import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_EMAIL = "Typos! ERP <noreply@typoserp.com.br>";
const SITE_NAME = "Typos! ERP";

const corsHead = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function baseLayout(logoUrl: string, content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${SITE_NAME}</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#C45E1A 0%,#D4722E 100%);padding:32px 40px;text-align:center;">
            <img src="${logoUrl}" alt="${SITE_NAME}" width="180" style="display:inline-block;max-width:180px;" />
          </td>
        </tr>
        <tr><td style="padding:40px;">${content}</td></tr>
        <tr>
          <td style="padding:24px 40px;background-color:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">© ${new Date().getFullYear()} ${SITE_NAME}. Todos os direitos reservados.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "🔴 Urgente",
};

const categoryLabels: Record<string, string> = {
  support: "Suporte",
  feature_request: "Ajuste técnico",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

function newTicketTemplate(logoUrl: string, ticketNumber: number, subject: string, priority: string, category: string, message: string, senderName: string) {
  const catLabel = categoryLabels[category] || "Suporte";
  const isFeature = category === "feature_request";
  const headline = isFeature ? "Nova Solicitação de Ajuste Técnico 🛠️" : "Novo Chamado de Suporte 🎫";
  const subline = isFeature
    ? "Um cliente solicitou uma personalização, novo módulo ou ajuste no sistema."
    : "Um novo ticket foi aberto e aguarda atendimento.";
  return baseLayout(logoUrl, `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;text-align:center;">${headline}</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#666;text-align:center;">${subline}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5EE;border:1px solid #F0D4C0;border-radius:12px;padding:0;margin:0 0 24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 8px;font-size:13px;color:#888;"><strong>Ticket:</strong> #${ticketNumber}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#888;"><strong>Categoria:</strong> ${catLabel}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#888;"><strong>Assunto:</strong> ${subject}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#888;"><strong>Prioridade:</strong> ${priorityLabels[priority] || priority}</p>
        <p style="margin:0;font-size:13px;color:#888;"><strong>Aberto por:</strong> ${senderName}</p>
      </td></tr>
    </table>
    <div style="background:#f9f9f9;border-left:4px solid #C45E1A;border-radius:0 8px 8px 0;padding:16px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;">${message}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#999;text-align:center;">Acesse o sistema para responder este chamado.</p>
  `);
}

function statusChangeTemplate(logoUrl: string, ticketNumber: number, subject: string, category: string, previousStatus: string, newStatus: string) {
  const catLabel = categoryLabels[category] || "Suporte";
  const isResolved = newStatus === "resolved" || newStatus === "closed";
  const headline = isResolved ? "Chamado Concluído ✅" : "Atualização do seu Chamado 🔄";
  const subline = isResolved
    ? "Sua solicitação foi finalizada pela nossa equipe."
    : `Status alterado de ${statusLabels[previousStatus] || previousStatus} para ${statusLabels[newStatus] || newStatus}.`;
  return baseLayout(logoUrl, `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;text-align:center;">${headline}</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#666;text-align:center;">${subline}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5EE;border:1px solid #F0D4C0;border-radius:12px;padding:0;margin:0 0 24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 8px;font-size:13px;color:#888;"><strong>Ticket:</strong> #${ticketNumber}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#888;"><strong>Categoria:</strong> ${catLabel}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#888;"><strong>Assunto:</strong> ${subject}</p>
        <p style="margin:0;font-size:13px;color:#888;"><strong>Novo status:</strong> ${statusLabels[newStatus] || newStatus}</p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#999;text-align:center;">Acesse o sistema para conferir os detalhes do chamado.</p>
  `);
}

function newMessageTemplate(logoUrl: string, ticketNumber: number, subject: string, senderName: string, message: string, isFromSupport: boolean) {
  const title = isFromSupport ? "Resposta do Suporte 💬" : "Nova Mensagem no Chamado 💬";
  const subtitle = isFromSupport
    ? "A equipe de suporte respondeu seu chamado."
    : `${senderName} enviou uma nova mensagem.`;

  return baseLayout(logoUrl, `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;text-align:center;">${title}</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#666;text-align:center;">${subtitle}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5EE;border:1px solid #F0D4C0;border-radius:12px;padding:0;margin:0 0 16px;">
      <tr><td style="padding:16px;">
        <p style="margin:0;font-size:13px;color:#888;"><strong>Ticket:</strong> #${ticketNumber} — ${subject}</p>
      </td></tr>
    </table>
    <div style="background:#f9f9f9;border-left:4px solid #C45E1A;border-radius:0 8px 8px 0;padding:16px;margin:0 0 24px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#C45E1A;">${senderName}</p>
      <p style="margin:0;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;">${message}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#999;text-align:center;">Acesse o sistema para continuar a conversa.</p>
  `);
}

async function sendEmail(to: string, subject: string, html: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    console.error("Missing API keys for email");
    return;
  }

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Resend error:", JSON.stringify(data));
  } else {
    console.log(`Email sent to ${to}: ${subject}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHead });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const logoUrl = `${SUPABASE_URL}/storage/v1/object/public/email-assets/typos-logo.png`;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { type, ticket_id, ticket_number, subject, priority, category, message, sender_name, sender_type, created_by, previous_status, new_status } = await req.json();
    const cat = category || "support";
    const catLabel = categoryLabels[cat] || "Suporte";

    // Get all superadmin emails
    const { data: admins } = await sb.from("super_admins").select("email");
    const adminEmails = (admins || []).map((a: any) => a.email);

    // Get client email from created_by user id
    let clientEmail: string | null = null;
    if (created_by) {
      const { data: userData } = await sb.auth.admin.getUserById(created_by);
      clientEmail = userData?.user?.email || null;
    }

    if (type === "new_ticket") {
      const html = newTicketTemplate(logoUrl, ticket_number, subject, priority, cat, message, sender_name);
      const emailSubject = `[Ticket #${ticket_number}] [${catLabel}] ${subject} — Novo Chamado`;
      for (const email of adminEmails) {
        await sendEmail(email, emailSubject, html);
      }
      // Confirm to client
      if (clientEmail) {
        const isFeature = cat === "feature_request";
        const clientHtml = baseLayout(logoUrl, `
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;text-align:center;">${isFeature ? "Solicitação Recebida ✅" : "Chamado Recebido ✅"}</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#666;text-align:center;line-height:1.6;">${isFeature
            ? `Sua solicitação de ajuste técnico <strong>#${ticket_number}</strong> foi registrada. Nossa equipe vai analisar e entrar em contato com mais detalhes.`
            : `Seu chamado <strong>#${ticket_number}</strong> foi aberto com sucesso. Nossa equipe responderá em breve.`}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5EE;border:1px solid #F0D4C0;border-radius:12px;padding:0;margin:0 0 24px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 8px;font-size:13px;color:#888;"><strong>Ticket:</strong> #${ticket_number}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#888;"><strong>Categoria:</strong> ${catLabel}</p>
              <p style="margin:0;font-size:13px;color:#888;"><strong>Assunto:</strong> ${subject}</p>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;color:#999;text-align:center;">Você receberá um e-mail a cada movimentação do chamado.</p>
        `);
        await sendEmail(clientEmail, `[Ticket #${ticket_number}] ${isFeature ? "Solicitação registrada" : "Chamado recebido"} — ${SITE_NAME}`, clientHtml);
      }
    } else if (type === "new_message") {
      const isFromSupport = sender_type === "support";
      const html = newMessageTemplate(logoUrl, ticket_number, subject, sender_name, message, isFromSupport);
      const emailSubject = `[Ticket #${ticket_number}] Nova mensagem — ${subject}`;

      if (isFromSupport) {
        if (clientEmail) {
          await sendEmail(clientEmail, emailSubject, html);
        }
      } else {
        // Client replied → notify superadmins
        for (const email of adminEmails) {
          await sendEmail(email, emailSubject, html);
        }
      }
    } else if (type === "status_change") {
      const html = statusChangeTemplate(logoUrl, ticket_number, subject, cat, previous_status, new_status);
      const isResolved = new_status === "resolved" || new_status === "closed";
      const emailSubject = `[Ticket #${ticket_number}] ${isResolved ? "Chamado concluído" : "Status atualizado"} — ${subject}`;
      if (clientEmail) {
        await sendEmail(clientEmail, emailSubject, html);
      }
      // Also notify superadmins for visibility
      for (const email of adminEmails) {
        await sendEmail(email, emailSubject, html);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHead, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHead, "Content-Type": "application/json" },
    });
  }
});
