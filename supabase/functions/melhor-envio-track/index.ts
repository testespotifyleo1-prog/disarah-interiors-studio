// Melhor Envio Track — consulta status atual de uma etiqueta
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { accountId, order_ids } = await req.json();
    const { data: conn } = await admin.from('melhor_envio_connections').select('*').eq('account_id', accountId).eq('is_active', true).maybeSingle();
    if (!conn) return jsonResponse({ error: 'Não conectado' }, 400);
    const { data: global } = await admin.from('melhor_envio_global_credentials').select('*').eq('is_active', true).maybeSingle();
    const apiHost = global?.is_sandbox ? 'https://sandbox.melhorenvio.com.br/api' : 'https://melhorenvio.com.br/api';
    const r = await fetch(`${apiHost}/v2/me/shipment/tracking`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conn.access_token}`,
        'Content-Type': 'application/json', 'Accept': 'application/json',
        'User-Agent': 'Typos ERP (suporte@typoserp.com.br)',
      },
      body: JSON.stringify({ orders: order_ids }),
    });
    const result = await r.json();
    return jsonResponse(result, r.status);
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
