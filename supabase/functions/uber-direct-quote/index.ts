// Uber Direct Quote — cota entrega expressa
// Docs: https://developer.uber.com/docs/deliveries/api-reference
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

const UBER_AUTH = 'https://auth.uber.com/oauth/v2/token';

async function getUberToken(global: any) {
  const r = await fetch(UBER_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: global.client_id,
      client_secret: global.client_secret,
      grant_type: 'client_credentials',
      scope: 'eats.deliveries direct.organizations',
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
    const { accountId, dropoff_address, dropoff_phone, manifest_total_value } = await req.json();

    const { data: conn } = await admin.from('uber_direct_connections').select('*').eq('account_id', accountId).eq('is_active', true).maybeSingle();
    if (!conn) return jsonResponse({ options: [] });
    const { data: global } = await admin.from('uber_direct_global_credentials').select('*').eq('is_active', true).maybeSingle();
    if (!global) return jsonResponse({ options: [] });

    const token = await getUberToken(global);
    const apiHost = global.is_sandbox ? 'https://sandbox-api.uber.com' : 'https://api.uber.com';

    const r = await fetch(`${apiHost}/v1/customers/${global.customer_id}/delivery_quotes`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup_address: JSON.stringify(conn.pickup_address),
        dropoff_address: typeof dropoff_address === 'string' ? dropoff_address : JSON.stringify(dropoff_address),
        dropoff_phone_number: dropoff_phone,
        manifest_total_value: Math.round(Number(manifest_total_value || 0) * 100),
      }),
    });
    const result = await r.json();
    if (!r.ok) return jsonResponse({ options: [], error: result }, 200);

    const fee = (result.fee || 0) / 100;
    return jsonResponse({
      options: [{
        id: result.id,
        name: 'Uber Direct',
        carrier_slug: 'uber_direct',
        price: fee,
        delivery_minutes: result.duration,
        pickup_duration: result.pickup_duration,
        dropoff_eta: result.dropoff_eta,
        pickup_eta: result.pickup_eta,
        expires: result.expires,
        currency: result.currency || 'BRL',
        fee_breakdown: [
          { label: 'Taxa de coleta e entrega', amount: fee },
        ],
      }],
    });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e), options: [] });
  }
});
