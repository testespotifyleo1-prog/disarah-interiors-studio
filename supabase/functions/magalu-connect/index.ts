// Magalu Marketplace Connect — OAuth2
// Docs: https://developer.luizalabs.com/api-product/api-marketplace
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse, getCallbackUrl, encodeState, decodeState, redirectToApp } from '../_shared/integrations.ts';

const MAGALU_AUTH = 'https://id.magalu.com/oauth/authorize';
const MAGALU_TOKEN = 'https://id.magalu.com/oauth/token';

async function loadGlobal(admin: ReturnType<typeof createClient>) {
  const { data } = await admin.from('magalu_global_credentials').select('*').eq('is_active', true).maybeSingle();
  return data as any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) return jsonResponse({ error: 'missing params' }, 400);
      const { accountId, storeId, returnUrl } = decodeState<any>(state);
      const global = await loadGlobal(admin);
      if (!global) return redirectToApp(returnUrl, { magalu: 'error', reason: 'no_global_credentials' });

      const r = await fetch(MAGALU_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: getCallbackUrl(req, 'magalu-connect'),
          client_id: global.client_id,
          client_secret: global.client_secret,
        }),
      });
      const tk = await r.json();
      if (!r.ok) return redirectToApp(returnUrl, { magalu: 'error', reason: tk?.error || 'token_failed' });

      await admin.from('magalu_connections').upsert({
        account_id: accountId,
        store_id: storeId || null,
        seller_id: tk.seller_id || null,
        refresh_token: tk.refresh_token,
        access_token: tk.access_token,
        token_expires_at: new Date(Date.now() + (tk.expires_in || 3600) * 1000).toISOString(),
        is_active: true,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'account_id' });

      return redirectToApp(returnUrl, { magalu: 'connected' });
    }

    const body = await req.json();
    if (body.action === 'authorize') {
      const global = await loadGlobal(admin);
      if (!global) return jsonResponse({ error: 'Magalu não configurado pelo Super Admin' }, 400);
      const state = encodeState({ accountId: body.accountId, storeId: body.storeId, returnUrl: body.returnUrl });
      const u = new URL(MAGALU_AUTH);
      u.searchParams.set('response_type', 'code');
      u.searchParams.set('client_id', global.client_id);
      u.searchParams.set('redirect_uri', getCallbackUrl(req, 'magalu-connect'));
      u.searchParams.set('state', state);
      u.searchParams.set('scope', global.scope || 'openid offline_access marketplace');
      return jsonResponse({ authorize_url: u.toString() });
    }
    if (body.action === 'disconnect') {
      await admin.from('magalu_connections').update({ is_active: false }).eq('id', body.connectionId);
      return jsonResponse({ success: true });
    }
    return jsonResponse({ error: 'invalid action' }, 400);
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
