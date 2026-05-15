// Melhor Envio Buy Label — adiciona ao carrinho, faz checkout e gera etiqueta
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { accountId, saleId, service_id, from, to, products, volumes } = await req.json();

    const { data: conn } = await admin.from('melhor_envio_connections').select('*').eq('account_id', accountId).eq('is_active', true).maybeSingle();
    if (!conn) return jsonResponse({ error: 'Não conectado' }, 400);
    const { data: global } = await admin.from('melhor_envio_global_credentials').select('*').eq('is_active', true).maybeSingle();
    const apiHost = global?.is_sandbox ? 'https://sandbox.melhorenvio.com.br/api' : 'https://melhorenvio.com.br/api';
    const token = conn.access_token;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Typos ERP (suporte@typoserp.com.br)',
    };

    // 1) cart
    const cartRes = await fetch(`${apiHost}/v2/me/cart`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ service: service_id, from, to, products, volumes, options: { receipt: false, own_hand: false, reverse: false, non_commercial: true } }),
    });
    const cart = await cartRes.json();
    if (!cartRes.ok) return jsonResponse({ error: cart }, cartRes.status);

    // 2) checkout
    const coRes = await fetch(`${apiHost}/v2/me/shipment/checkout`, {
      method: 'POST', headers, body: JSON.stringify({ orders: [cart.id] }),
    });
    const co = await coRes.json();
    if (!coRes.ok) return jsonResponse({ error: co }, coRes.status);

    // 3) generate
    const gRes = await fetch(`${apiHost}/v2/me/shipment/generate`, { method: 'POST', headers, body: JSON.stringify({ orders: [cart.id] }) });
    const g = await gRes.json();

    // 4) print URL
    const pRes = await fetch(`${apiHost}/v2/me/shipment/print`, { method: 'POST', headers, body: JSON.stringify({ mode: 'private', orders: [cart.id] }) });
    const p = await pRes.json();

    // Anota na venda
    if (saleId) {
      await admin.from('deliveries').update({
        tracking_code: g?.[cart.id]?.tracking || null,
        tracking_url: p?.url || null,
        carrier: 'melhor_envio',
      }).eq('sale_id', saleId);
    }

    return jsonResponse({ success: true, order_id: cart.id, label_url: p?.url, tracking: g?.[cart.id]?.tracking });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
