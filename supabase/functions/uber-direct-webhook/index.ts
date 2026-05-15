// Uber Direct Webhook — recebe atualizações de status do entregador
// Valida assinatura HMAC-SHA256 (header x-postmates-signature ou x-uber-signature)
// Docs: https://developer.uber.com/docs/deliveries/references/webhooks
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const rawBody = await req.text();

    // Verifica assinatura se houver secret configurado
    const { data: global } = await admin.from('uber_direct_global_credentials')
      .select('webhook_signing_secret').eq('is_active', true).maybeSingle();
    const secret = (global as any)?.webhook_signing_secret as string | undefined;
    if (secret) {
      const sigHeader = req.headers.get('x-postmates-signature') || req.headers.get('x-uber-signature') || '';
      const expected = await hmacSha256Hex(secret, rawBody);
      if (!sigHeader || !timingSafeEqual(sigHeader.toLowerCase(), expected.toLowerCase())) {
        console.warn('[uber-direct-webhook] invalid signature, rejecting');
        return jsonResponse({ error: 'invalid signature' }, 401);
      }
    }

    let event: any;
    try { event = JSON.parse(rawBody); } catch { return jsonResponse({ error: 'invalid json' }, 400); }
    console.log('[uber-direct-webhook]', JSON.stringify(event).slice(0, 500));

    const deliveryId = event?.data?.id || event?.delivery_id;
    const status = event?.data?.status || event?.status;
    if (deliveryId && status) {
      const map: Record<string, string> = {
        'delivered': 'delivered', 'canceled': 'canceled', 'returned': 'canceled',
        'pickup': 'in_transit', 'pickup_complete': 'in_transit',
        'dropoff': 'in_transit', 'pending': 'pending',
      };
      await admin.from('deliveries').update({
        status: map[status] || 'in_transit',
      }).eq('tracking_code', deliveryId).eq('carrier', 'uber_direct');
    }

    await admin.from('webhook_events').insert({
      provider: 'uber_direct',
      event_type: event?.kind || event?.event_type || event?.event || 'unknown',
      payload: event,
    }).catch(() => {});

    return jsonResponse({ received: true });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
