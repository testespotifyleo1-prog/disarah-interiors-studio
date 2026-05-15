// Amazon Orders Webhook (SQS / SP-API Notifications relay)
// Processa ORDER_CHANGE e cria registro de delivery + log
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const event = await req.json();
    const eventType = event?.notificationType || event?.NotificationType || 'unknown';
    console.log('[amazon-orders-webhook]', eventType, JSON.stringify(event).slice(0, 500));

    // Persiste evento bruto
    await admin.from('webhook_events').insert({
      provider: 'amazon',
      event_type: eventType,
      payload: event,
    }).catch(() => {});

    // ORDER_CHANGE: vincula a uma loja pelo seller_id e registra notificação
    if (eventType === 'ORDER_CHANGE' || eventType === 'ANY_OFFER_CHANGED') {
      const sellerId = event?.payload?.OrderChangeNotification?.SellerId
        || event?.Payload?.OrderChangeNotification?.SellerId;
      if (sellerId) {
        const { data: conn } = await admin.from('amazon_connections')
          .select('account_id, store_id').eq('seller_id', sellerId).eq('is_active', true).maybeSingle();
        if (conn) {
          // Notificação para o admin processar manualmente (criação de venda exige Orders API + items)
          await admin.from('webhook_events').insert({
            provider: 'amazon',
            event_type: `${eventType}_routed`,
            payload: { account_id: conn.account_id, store_id: conn.store_id, original: event },
          }).catch(() => {});
        }
      }
    }

    return jsonResponse({ received: true, type: eventType });
  } catch (e: any) {
    console.error('[amazon-orders-webhook] error', e?.message);
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
