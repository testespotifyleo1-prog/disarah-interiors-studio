// Uber Direct Create Delivery — dispara o motorista
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

const UBER_AUTH = 'https://auth.uber.com/oauth/v2/token';

async function getUberToken(global: any) {
  const r = await fetch(UBER_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: global.client_id, client_secret: global.client_secret,
      grant_type: 'client_credentials', scope: 'eats.deliveries direct.organizations',
    }),
  });
  const tk = await r.json();
  if (!r.ok) throw new Error(tk?.error_description || 'uber auth failed');
  return tk.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();
    const {
      accountId, saleId, quote_id,
      dropoff_name, dropoff_address, dropoff_phone, dropoff_notes,
      manifest_items, manifest_total_value,
    } = body;

    const { data: conn } = await admin.from('uber_direct_connections').select('*').eq('account_id', accountId).eq('is_active', true).maybeSingle();
    if (!conn) return jsonResponse({ error: 'Uber Direct não ativo' }, 400);
    const { data: global } = await admin.from('uber_direct_global_credentials').select('*').eq('is_active', true).maybeSingle();
    if (!global) return jsonResponse({ error: 'Credenciais globais ausentes' }, 400);

    const token = await getUberToken(global);
    const apiHost = global.is_sandbox ? 'https://sandbox-api.uber.com' : 'https://api.uber.com';

    const r = await fetch(`${apiHost}/v1/customers/${global.customer_id}/deliveries`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quote_id,
        pickup_name: conn.business_name,
        pickup_address: JSON.stringify(conn.pickup_address),
        pickup_phone_number: conn.contact_phone,
        dropoff_name,
        dropoff_address: typeof dropoff_address === 'string' ? dropoff_address : JSON.stringify(dropoff_address),
        dropoff_phone_number: dropoff_phone,
        dropoff_notes,
        manifest_items: manifest_items || [{ name: 'Pedido', quantity: 1, size: 'small', price: Math.round(Number(manifest_total_value || 0) * 100) }],
        manifest_total_value: Math.round(Number(manifest_total_value || 0) * 100),
      }),
    });
    const result = await r.json();
    if (!r.ok) return jsonResponse({ error: result }, r.status);

    if (saleId) {
      await admin.from('deliveries').update({
        carrier: 'uber_direct',
        tracking_url: result.tracking_url,
        tracking_code: result.id,
        status: 'in_transit',
      }).eq('sale_id', saleId);
    }

    return jsonResponse({ success: true, delivery_id: result.id, tracking_url: result.tracking_url, courier: result.courier });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
