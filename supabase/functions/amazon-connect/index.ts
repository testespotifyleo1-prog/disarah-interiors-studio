// Amazon SP-API Connect — OAuth via LWA (Login with Amazon)
// Docs: https://developer-docs.amazon.com/sp-api/docs/website-authorization-workflow
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse, getCallbackUrl, encodeState, decodeState, redirectToApp } from '../_shared/integrations.ts';

const LWA_AUTH = 'https://sellercentral.amazon.com.br/apps/authorize/consent';
const LWA_TOKEN = 'https://api.amazon.com/auth/o2/token';

async function loadGlobal(admin: ReturnType<typeof createClient>) {
  const { data } = await admin.from('amazon_global_credentials').select('*').eq('is_active', true).maybeSingle();
  return data as any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    // Callback
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('spapi_oauth_code');
      const state = url.searchParams.get('state');
      const sellingPartnerId = url.searchParams.get('selling_partner_id');
      if (!code || !state) return jsonResponse({ error: 'missing code/state' }, 400);

      const { accountId, storeId, returnUrl } = decodeState<any>(state);
      const global = await loadGlobal(admin);
      if (!global) return redirectToApp(returnUrl, { amazon: 'error', reason: 'no_global_credentials' });

      const tokenRes = await fetch(LWA_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: getCallbackUrl(req, 'amazon-connect'),
          client_id: global.lwa_client_id,
          client_secret: global.lwa_client_secret,
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) return redirectToApp(returnUrl, { amazon: 'error', reason: tokens?.error || 'token_exchange_failed' });

      await admin.from('amazon_connections').upsert({
        account_id: accountId,
        store_id: storeId || null,
        seller_id: sellingPartnerId,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        is_active: true,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'account_id' });

      return redirectToApp(returnUrl, { amazon: 'connected' });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'authorize') {
      const { accountId, storeId, returnUrl } = body;
      const global = await loadGlobal(admin);
      if (!global?.app_id) return jsonResponse({ error: 'Credenciais Amazon não configuradas pelo Super Admin (app_id ausente)' }, 400);
      const state = encodeState({ accountId, storeId, returnUrl });
      const authUrl = new URL(LWA_AUTH);
      authUrl.searchParams.set('application_id', global.app_id);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('redirect_uri', getCallbackUrl(req, 'amazon-connect'));
      if (global.is_sandbox) authUrl.searchParams.set('version', 'beta');
      return jsonResponse({ authorize_url: authUrl.toString() });
    }

    if (action === 'disconnect') {
      const { connectionId } = body;
      await admin.from('amazon_connections').update({ is_active: false }).eq('id', connectionId);
      return jsonResponse({ success: true });
    }

    if (action === 'refresh') {
      const { connectionId } = body;
      const { data: conn } = await admin.from('amazon_connections').select('*').eq('id', connectionId).maybeSingle();
      if (!conn) return jsonResponse({ error: 'connection not found' }, 404);
      const global = await loadGlobal(admin);
      const r = await fetch(LWA_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: conn.refresh_token,
          client_id: global.lwa_client_id,
          client_secret: global.lwa_client_secret,
        }),
      });
      const tk = await r.json();
      if (!r.ok) return jsonResponse({ error: tk }, 400);
      await admin.from('amazon_connections').update({
        access_token: tk.access_token,
        token_expires_at: new Date(Date.now() + (tk.expires_in || 3600) * 1000).toISOString(),
      }).eq('id', connectionId);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'invalid action' }, 400);
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
