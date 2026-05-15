// Melhor Envio Quote — calcula frete em tempo real para o checkout
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

async function ensureToken(admin: ReturnType<typeof createClient>, conn: any, global: any, apiHost: string) {
  if (conn.token_expires_at && new Date(conn.token_expires_at) > new Date(Date.now() + 60000)) return conn.access_token;
  const r = await fetch(`${apiHost.replace('/api','')}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
      client_id: global.client_id,
      client_secret: global.client_secret,
    }),
  });
  const tk = await r.json();
  if (!r.ok) throw new Error(tk?.error || 'refresh failed');
  await admin.from('melhor_envio_connections').update({
    access_token: tk.access_token, refresh_token: tk.refresh_token || conn.refresh_token,
    token_expires_at: new Date(Date.now() + (tk.expires_in || 3600) * 1000).toISOString(),
  }).eq('id', conn.id);
  return tk.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { accountId, destination_zipcode, items } = await req.json();
    if (!accountId || !destination_zipcode) return jsonResponse({ error: 'params required' }, 400);

    const { data: conn } = await admin.from('melhor_envio_connections').select('*').eq('account_id', accountId).eq('is_active', true).maybeSingle();
    if (!conn) return jsonResponse({ options: [] });
    const { data: global } = await admin.from('melhor_envio_global_credentials').select('*').eq('is_active', true).maybeSingle();
    if (!global) return jsonResponse({ options: [] });

    const apiHost = global.is_sandbox ? 'https://sandbox.melhorenvio.com.br/api' : 'https://melhorenvio.com.br/api';
    const token = await ensureToken(admin, conn, global, apiHost);

    const products = (items && items.length) ? items : [{
      width: conn.default_width_cm, height: conn.default_height_cm, length: conn.default_length_cm,
      weight: (conn.default_weight_grams || 500) / 1000, insurance_value: 0, quantity: 1,
    }];

    const r = await fetch(`${apiHost}/v2/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Typos ERP (suporte@typoserp.com.br)',
      },
      body: JSON.stringify({
        from: { postal_code: (conn.origin_zipcode || '').replace(/\D/g, '') },
        to: { postal_code: String(destination_zipcode).replace(/\D/g, '') },
        products,
      }),
    });
    const result = await r.json();
    if (!r.ok) return jsonResponse({ error: result }, r.status);

    const enabled = new Set((conn.enabled_carriers || []) as string[]);
    const markup = Number(conn.markup_percent || 0) / 100;
    const options = (result || [])
      .filter((o: any) => !o.error)
      .map((o: any) => ({
        id: o.id,
        name: `${o.company?.name || ''} ${o.name}`.trim(),
        carrier_slug: `${(o.company?.name || '').toLowerCase()}_${(o.name || '').toLowerCase().replace(/\s+/g, '_')}`,
        price: Number(o.custom_price || o.price) * (1 + markup),
        delivery_days: o.delivery_time,
        company: o.company?.name,
      }))
      .filter((o: any) => enabled.size === 0 || Array.from(enabled).some(k => o.carrier_slug.includes(String(k).replace(/_/g,''))));

    return jsonResponse({ options });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
