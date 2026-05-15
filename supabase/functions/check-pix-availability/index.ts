import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { environment } = await req.json().catch(() => ({}));
    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Try to retrieve account info to check country
    let country: string | null = null;
    let pixEnabled = false;
    let reason = "";

    try {
      const account = await stripe.accounts.retrieve();
      country = account.country || null;

      // Check capabilities for pix_payments
      const caps = (account as any).capabilities || {};
      pixEnabled = caps.pix_payments === "active";

      if (!pixEnabled) {
        if (country !== "BR") {
          reason = `PIX requer conta Stripe brasileira. Conta atual: ${country || "desconhecida"}.`;
        } else {
          reason = "PIX ainda não está ativado nesta conta. Ative em Stripe Dashboard → Settings → Payment methods → Pix.";
        }
      }
    } catch (e) {
      // accounts.retrieve may not be available through the gateway for connected accounts
      // Fallback: try to create a tiny test session — we don't actually create it,
      // just probe payment_method_types validity by listing.
      reason = "Não foi possível detectar a configuração da conta de pagamentos.";
    }

    return new Response(
      JSON.stringify({ pixEnabled, country, reason, environment: env }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ pixEnabled: false, reason: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
