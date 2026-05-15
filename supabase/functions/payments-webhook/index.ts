import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Map Stripe price lookup keys to plan slugs
const PRICE_TO_PLAN_SLUG: Record<string, string> = {
  start_monthly: 'start',
  pro_monthly: 'pro',
  multi_monthly: 'multi',
  prime_monthly: 'prime',
  start_pix_monthly: 'start',
  start_pix_yearly: 'start',
  pro_pix_monthly: 'pro',
  pro_pix_yearly: 'pro',
  multi_pix_monthly: 'multi',
  multi_pix_yearly: 'multi',
  prime_pix_monthly: 'prime',
  prime_pix_yearly: 'prime',
};

// Map PIX price IDs to access duration in days
const PIX_DURATION_DAYS: Record<string, number> = {
  start_pix_monthly: 30,
  pro_pix_monthly: 30,
  multi_pix_monthly: 30,
  prime_pix_monthly: 30,
  start_pix_yearly: 365,
  pro_pix_yearly: 365,
  multi_pix_yearly: 365,
  prime_pix_yearly: 365,
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Received event:", event.type, "env:", env);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object, env);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, env);
        break;
      case "invoice.payment_failed":
        console.log("Payment failed:", event.data.object.id);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  console.log("Checkout completed:", session.id, "mode:", session.mode, "status:", session.payment_status);

  // AI Credits purchase (one-time card)
  if (session.mode === 'payment' && session.payment_status === 'paid' && session.metadata?.purpose === 'ai_credits') {
    await activateAiCreditsPurchase(session.metadata, session.id);
    return;
  }

  // Para PIX (one-time), ativar plano com prazo definido
  if (session.mode === 'payment' && session.payment_status === 'paid') {
    await activatePixPlan(session.metadata);
  }
}

async function activateAiCreditsPurchase(metadata: any, sessionId: string) {
  const accountId = metadata?.accountId;
  const purchaseId = metadata?.purchaseId;
  const credits = parseInt(metadata?.credits || '0', 10);

  if (!accountId || !purchaseId || !credits) {
    console.error("AI Credits: Missing metadata", { accountId, purchaseId, credits });
    return;
  }

  // Idempotency: skip if already paid
  const { data: existing } = await supabase
    .from('ai_credit_purchases')
    .select('id, status')
    .eq('id', purchaseId)
    .maybeSingle();

  if (!existing) {
    console.error("AI Credits: Purchase not found:", purchaseId);
    return;
  }
  if (existing.status === 'paid') {
    console.log("AI Credits: Purchase already paid, skipping:", purchaseId);
    return;
  }

  // Add credits via DB function
  const { error: rpcErr } = await supabase.rpc('add_purchased_ai_credits', {
    _account_id: accountId,
    _credits: credits,
    _purchase_id: purchaseId,
    _notes: `Compra Stripe — ${credits} créditos (sessão ${sessionId})`,
  });
  if (rpcErr) {
    console.error("AI Credits: Failed to add credits:", rpcErr);
    return;
  }

  // Mark purchase as paid
  await supabase
    .from('ai_credit_purchases')
    .update({ status: 'paid', reviewed_at: new Date().toISOString() })
    .eq('id', purchaseId);

  console.log("AI Credits: Activated", credits, "credits for account", accountId);
}

async function activatePixPlan(metadata: any) {
  const accountId = metadata?.accountId;
  const planPriceId = metadata?.planPriceId;

  if (!accountId || !planPriceId) {
    console.log("PIX: Missing accountId or planPriceId in metadata");
    return;
  }

  const planSlug = PRICE_TO_PLAN_SLUG[planPriceId];
  const durationDays = PIX_DURATION_DAYS[planPriceId];

  if (!planSlug || !durationDays) {
    console.log("PIX: Unknown planPriceId:", planPriceId);
    return;
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('slug', planSlug)
    .eq('is_active', true)
    .single();

  if (!plan) {
    console.error("PIX: Plan not found for slug:", planSlug);
    return;
  }

  const accessUntil = new Date();
  accessUntil.setDate(accessUntil.getDate() + durationDays);

  const { error } = await supabase
    .from('accounts')
    .update({
      plan_id: plan.id,
      plan_status: 'active',
      pix_plan_id: plan.id,
      pix_access_until: accessUntil.toISOString(),
    })
    .eq('id', accountId);

  if (error) {
    console.error("PIX: Error activating plan:", error);
  } else {
    console.log("PIX: Account", accountId, "activated with plan", planSlug, "until", accessUntil.toISOString());
  }
}

async function activateAccountPlan(metadata: any) {
  const accountId = metadata?.accountId;
  const planPriceId = metadata?.planPriceId;
  
  if (!accountId || !planPriceId) {
    console.log("Missing accountId or planPriceId in metadata");
    return;
  }

  const planSlug = PRICE_TO_PLAN_SLUG[planPriceId];
  if (!planSlug) {
    console.log("Unknown planPriceId:", planPriceId);
    return;
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('slug', planSlug)
    .eq('is_active', true)
    .single();

  if (!plan) {
    console.error("Plan not found for slug:", planSlug);
    return;
  }

  const { error } = await supabase
    .from('accounts')
    .update({
      plan_id: plan.id,
      plan_status: 'active',
    })
    .eq('id', accountId);

  if (error) {
    console.error("Error activating account plan:", error);
  } else {
    console.log("Account", accountId, "activated with plan", planSlug);
  }
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.lookup_key || item?.price?.id;
  const productId = item?.price?.product;

  const periodStart = subscription.current_period_start;
  const periodEnd = subscription.current_period_end;

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  await activateAccountPlan(subscription.metadata);
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.lookup_key || item?.price?.id;
  const productId = item?.price?.product;

  const periodStart = subscription.current_period_start;
  const periodEnd = subscription.current_period_end;

  await supabase
    .from("subscriptions")
    .update({
      status: subscription.status,
      product_id: productId,
      price_id: priceId,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  if (subscription.status === 'active') {
    await activateAccountPlan(subscription.metadata);
  }

  if (subscription.status === 'canceled') {
    const accountId = subscription.metadata?.accountId;
    if (accountId) {
      await supabase
        .from('accounts')
        .update({ plan_status: 'canceled' })
        .eq('id', accountId);
    }
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  const accountId = subscription.metadata?.accountId;
  if (accountId) {
    await supabase
      .from('accounts')
      .update({ plan_status: 'expired' })
      .eq('id', accountId);
  }
}
