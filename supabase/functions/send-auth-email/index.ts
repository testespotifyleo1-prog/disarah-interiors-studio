import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_EMAIL = "Typos! ERP <noreply@typoserp.com.br>";
const SITE_NAME = "Typos! ERP";

const corsHead = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOTP(): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

/* ─── Email templates ─── */

function baseLayout(logoUrl: string, content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${SITE_NAME}</title>
</head>
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
            <p style="margin:8px 0 0;font-size:11px;color:#bbb;line-height:1.4;">Este é um e-mail automático. Caso não tenha solicitado esta ação, ignore este e-mail.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function otpBlock(code: string) {
  return `<div style="text-align:center;margin:32px 0;">
    <div style="display:inline-block;background:linear-gradient(135deg,#FFF5EE 0%,#FFF0E6 100%);border:2px solid #C45E1A;border-radius:16px;padding:20px 40px;">
      <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:800;letter-spacing:12px;color:#C45E1A;">${code}</span>
    </div>
  </div>`;
}

function signupTemplate(logoUrl: string, code: string) {
  return baseLayout(logoUrl, `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a2e;text-align:center;">Bem-vindo ao ${SITE_NAME}! 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#666;text-align:center;line-height:1.6;">Estamos felizes em ter você conosco! Para ativar sua conta, use o código de verificação abaixo:</p>
    ${otpBlock(code)}
    <p style="margin:0 0 8px;font-size:14px;color:#888;text-align:center;line-height:1.5;">Digite este código na tela de confirmação para concluir seu cadastro.</p>
    <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">O código expira em <strong style="color:#C45E1A;">60 minutos</strong>.</p>
  `);
}

function recoveryTemplate(logoUrl: string, code: string) {
  return baseLayout(logoUrl, `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a2e;text-align:center;">Redefinir sua senha 🔐</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#666;text-align:center;line-height:1.6;">Recebemos uma solicitação para redefinir a senha da sua conta. Use o código abaixo:</p>
    ${otpBlock(code)}
    <p style="margin:0 0 8px;font-size:14px;color:#888;text-align:center;line-height:1.5;">Insira este código na tela de redefinição de senha.</p>
    <p style="margin:0;font-size:13px;color:#aaa;text-align:center;">O código expira em <strong style="color:#C45E1A;">60 minutos</strong>.<br/>Se você não solicitou, ignore este e-mail.</p>
  `);
}

/* ─── Main handler ─── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHead });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const logoUrl = `${SUPABASE_URL}/storage/v1/object/public/email-assets/typos-logo.png`;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { email, type } = await req.json();

    if (!email || !type) {
      return new Response(JSON.stringify({ error: "email and type are required" }), {
        status: 400, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    if (!["signup", "recovery"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400, headers: { ...corsHead, "Content-Type": "application/json" },
      });
    }

    // For recovery, verify the user exists
    if (type === "recovery") {
      const { data: users } = await supabase.auth.admin.listUsers();
      const userExists = users?.users?.some((u: any) => u.email === email);
      if (!userExists) {
        // Don't reveal if user exists or not - return success anyway
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHead, "Content-Type": "application/json" },
        });
      }
    }

    // Invalidate previous unused codes for this email+type
    await supabase.from("email_verification_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("type", type)
      .eq("used", false);

    // Generate and store OTP
    const code = generateOTP();
    const { error: insertError } = await supabase.from("email_verification_codes").insert({
      email,
      code,
      type,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      console.error("DB insert error:", insertError);
      throw new Error("Failed to create verification code");
    }

    // Pick template
    let html: string;
    let subject: string;

    if (type === "signup") {
      subject = `Confirme sua conta - ${SITE_NAME}`;
      html = signupTemplate(logoUrl, code);
    } else {
      subject = `Redefinir senha - ${SITE_NAME}`;
      html = recoveryTemplate(logoUrl, code);
    }

    // Send via Resend
    const resendResponse = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html,
      }),
    });

    const resendData = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error("Resend error:", JSON.stringify(resendData));
      throw new Error(`Resend failed [${resendResponse.status}]: ${JSON.stringify(resendData)}`);
    }

    console.log(`OTP email sent to ${email} (type: ${type})`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHead, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHead, "Content-Type": "application/json" },
    });
  }
});
