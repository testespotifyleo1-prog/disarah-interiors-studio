import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHead = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Rule {
  id: string;
  name: string;
  is_active: boolean;
  match_categories: string[];
  match_priorities: string[];
  match_statuses: string[];
  keywords: string[];
  tags: string[];
  severity: string;
  require_unread: boolean;
}

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function evaluateRule(rule: Rule, ticket: any, lastMessage: string): { matches: boolean; matched_keywords: string[] } {
  if (!rule.is_active) return { matches: false, matched_keywords: [] };
  if (rule.match_statuses.length && !rule.match_statuses.includes(ticket.status)) return { matches: false, matched_keywords: [] };
  if (rule.match_categories.length && !rule.match_categories.includes(ticket.category || "support")) return { matches: false, matched_keywords: [] };
  if (rule.match_priorities.length && !rule.match_priorities.includes(ticket.priority)) return { matches: false, matched_keywords: [] };

  if (rule.tags.length) {
    const tt: string[] = (ticket.tags || []).map((t: string) => norm(t));
    const hasAny = rule.tags.some((t) => tt.includes(norm(t)));
    if (!hasAny) return { matches: false, matched_keywords: [] };
  }

  let matchedKws: string[] = [];
  if (rule.keywords.length) {
    const hay = norm(`${ticket.subject || ""} ${lastMessage || ""}`);
    matchedKws = rule.keywords.filter((kw) => hay.includes(norm(kw)));
    if (!matchedKws.length) return { matches: false, matched_keywords: [] };
  }

  if (rule.require_unread && (ticket.support_unread_count ?? 0) === 0) {
    return { matches: false, matched_keywords: [] };
  }

  return { matches: true, matched_keywords: matchedKws };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHead });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { ticket_id } = await req.json();
    if (!ticket_id || typeof ticket_id !== "string") {
      return new Response(JSON.stringify({ error: "ticket_id required" }), {
        status: 400, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    const { data: ticket } = await sb.from("support_tickets").select("*").eq("id", ticket_id).maybeSingle();
    if (!ticket) {
      return new Response(JSON.stringify({ error: "ticket not found" }), {
        status: 404, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    const { data: lastMsg } = await sb
      .from("support_messages")
      .select("content, sender_type, sender_name")
      .eq("ticket_id", ticket_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastContent = lastMsg?.content || "";

    const { data: rules } = await sb.from("support_action_rules").select("*").eq("is_active", true);

    const matched: { rule: Rule; matched_keywords: string[] }[] = [];
    for (const r of (rules as Rule[] | null) || []) {
      const res = evaluateRule(r, ticket, lastContent);
      if (res.matches) matched.push({ rule: r, matched_keywords: res.matched_keywords });
    }

    if (!matched.length) {
      return new Response(JSON.stringify({ success: true, matched: 0 }), {
        status: 200, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    // Insert alerts (idempotent via unique partial index on open alerts)
    const created: any[] = [];
    for (const m of matched) {
      const reasonParts: string[] = [`Regra: ${m.rule.name}`];
      if (m.matched_keywords.length) reasonParts.push(`Palavras-chave: ${m.matched_keywords.join(", ")}`);
      const { data: ins, error } = await sb
        .from("support_action_alerts")
        .insert({
          ticket_id: ticket.id,
          rule_id: m.rule.id,
          account_id: ticket.account_id,
          severity: m.rule.severity,
          reason: reasonParts.join(" · "),
          matched_keywords: m.matched_keywords,
        })
        .select()
        .maybeSingle();
      if (!error && ins) created.push({ alert: ins, rule: m.rule });
    }

    if (!created.length) {
      return new Response(JSON.stringify({ success: true, matched: matched.length, created: 0 }), {
        status: 200, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    // Send emails to all super admins (one per newly created alert)
    const { data: admins } = await sb.from("super_admins").select("email");
    const adminEmails = (admins || []).map((a: any) => a.email).filter(Boolean);

    const { data: account } = await sb.from("accounts").select("name").eq("id", ticket.account_id).maybeSingle();
    const accountName = (account as any)?.name || "—";

    if (adminEmails.length) {
      const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
      const FROM_EMAIL = "Typos! ERP <noreply@typoserp.com.br>";
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const logoUrl = `${SUPABASE_URL}/storage/v1/object/public/email-assets/typos-logo.png`;

      const sevColors: Record<string, string> = {
        low: "#888888", normal: "#3B82F6", high: "#F59E0B", urgent: "#DC2626",
      };
      const sevLabels: Record<string, string> = {
        low: "Baixa", normal: "Normal", high: "Alta", urgent: "🔴 URGENTE",
      };

      for (const item of created) {
        const sev = item.rule.severity;
        const color = sevColors[sev] || "#3B82F6";
        const label = sevLabels[sev] || sev;
        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,${color} 0%,${color}cc 100%);padding:32px 40px;text-align:center;">
  <img src="${logoUrl}" alt="Typos! ERP" width="160" style="display:inline-block;max-width:160px;" />
  <p style="margin:16px 0 0;color:#fff;font-size:13px;font-weight:600;letter-spacing:0.5px;">⚠️ TICKET EXIGE AÇÃO — ${label}</p>
</td></tr>
<tr><td style="padding:32px 40px;">
  <h1 style="margin:0 0 8px;font-size:20px;color:#1a1a2e;">Ticket #${ticket.ticket_number} foi sinalizado</h1>
  <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.5;">
    Uma regra ativa foi acionada e este ticket precisa de atenção imediata.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5EE;border:1px solid #F0D4C0;border-radius:12px;margin:0 0 20px;">
    <tr><td style="padding:18px;">
      <p style="margin:0 0 6px;font-size:13px;color:#888;"><strong>Cliente:</strong> ${accountName}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#888;"><strong>Assunto:</strong> ${ticket.subject || "—"}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#888;"><strong>Status:</strong> ${ticket.status}</p>
      <p style="margin:0;font-size:13px;color:#888;"><strong>Regra acionada:</strong> ${item.rule.name}</p>
    </td></tr>
  </table>
  ${item.alert.matched_keywords?.length ? `
  <p style="margin:0 0 8px;font-size:13px;color:#666;"><strong>Palavras-chave detectadas:</strong></p>
  <p style="margin:0 0 20px;font-size:13px;color:${color};font-weight:600;">${item.alert.matched_keywords.join(", ")}</p>
  ` : ""}
  ${lastContent ? `
  <div style="background:#f9f9f9;border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:14px;margin:0 0 20px;">
    <p style="margin:0 0 4px;font-size:11px;color:#999;font-weight:600;text-transform:uppercase;">Última mensagem</p>
    <p style="margin:0;font-size:13px;color:#333;line-height:1.5;white-space:pre-wrap;">${(lastContent || "").slice(0, 500)}</p>
  </div>` : ""}
  <p style="margin:0;font-size:12px;color:#999;text-align:center;">Acesse o painel Super Admin → Suporte para responder.</p>
</td></tr>
<tr><td style="padding:20px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
  <p style="margin:0;font-size:11px;color:#999;">© ${new Date().getFullYear()} Typos! ERP</p>
</td></tr>
</table>
</td></tr></table></body></html>`;

        const subjectLine = `[AÇÃO] [${label}] Ticket #${ticket.ticket_number} — ${item.rule.name}`;

        if (LOVABLE_API_KEY && RESEND_API_KEY) {
          for (const to of adminEmails) {
            try {
              await fetch(`${GATEWAY_URL}/emails`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "X-Connection-Api-Key": RESEND_API_KEY,
                },
                body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: subjectLine, html }),
              });
            } catch (e) {
              console.error("email error", e);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, matched: matched.length, created: created.length }),
      { status: 200, headers: { ...corsHead, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("evaluate-support-action-rules error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHead, "Content-Type": "application/json" },
    });
  }
});
