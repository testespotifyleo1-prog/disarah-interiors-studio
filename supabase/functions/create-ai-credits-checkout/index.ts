import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email;

    const { package_id, account_id, environment, returnUrl } = await req.json();
    if (!package_id || !account_id) {
      return new Response(JSON.stringify({ error: "package_id and account_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify membership
    const { data: isMember } = await admin.rpc("is_account_member", {
      _user_id: userId,
      _account_id: account_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load package
    const { data: pkg, error: pkgErr } = await admin
      .from("ai_credit_packages")
      .select("*")
      .eq("id", package_id)
      .eq("is_active", true)
      .single();
    if (pkgErr || !pkg) {
      return new Response(JSON.stringify({ error: "Package not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create purchase row (pending)
    const { data: purchase, error: purchaseErr } = await admin
      .from("ai_credit_purchases")
      .insert({
        account_id,
        user_id: userId,
        package_id: pkg.id,
        credits: pkg.credits,
        price_cents: pkg.price_cents,
        payment_method: "card",
        status: "pending",
      })
      .select()
      .single();
    if (purchaseErr || !purchase) {
      return new Response(JSON.stringify({ error: purchaseErr?.message || "Failed to create purchase" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `${pkg.name} — ${pkg.credits} créditos IA`,
              description: pkg.description || `${pkg.credits} simulações inteligentes no ambiente`,
            },
            unit_amount: pkg.price_cents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded",
      return_url:
        returnUrl ||
        `${req.headers.get("origin")}/app/ai-simulations?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      ...(userEmail && { customer_email: userEmail }),
      payment_method_types: ["card"],
      metadata: {
        purpose: "ai_credits",
        accountId: account_id,
        userId,
        packageId: pkg.id,
        purchaseId: purchase.id,
        credits: String(pkg.credits),
      },
    });

    // Save Stripe session id
    await admin
      .from("ai_credit_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret, purchaseId: purchase.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("create-ai-credits-checkout error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
