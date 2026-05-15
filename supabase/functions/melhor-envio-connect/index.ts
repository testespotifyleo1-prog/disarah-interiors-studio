// Melhor Envio Connect — OAuth2
// Docs: https://docs.melhorenvio.com.br/docs/autenticacao
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse, getCallbackUrl, encodeState, decodeState, redirectToApp } from '../_shared/integrations.ts';

function hosts(sandbox: boolean) {
  return {
    auth: sandbox ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br',
    api: sandbox ? 'https://sandbox.melhorenvio.com.br/api' : 'https://melhorenvio.com.br/api',
  };
}

async function loadGlobal(admin: ReturnType<typeof createClient>) {
  const { data } = await admin.from('melhor_envio_global_credentials').select('*').eq('is_active', true).maybeSingle();
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
      if (!global) return redirectToApp(returnUrl, { me: 'error', reason: 'no_global_credentials' });
      const h = hosts(!!global.is_sandbox);

      const r = await fetch(`${h.auth}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: getCallbackUrl(req, 'melhor-envio-connect'),
          client_id: global.client_id,
          client_secret: global.client_secret,
        }),
      });
      const tk = await r.json();
      if (!r.ok) return redirectToApp(returnUrl, { me: 'error', reason: tk?.error || 'token_failed' });

      // Pega dados do usuário
      let userInfo: any = {};
      try {
        const ur = await fetch(`${h.api}/v2/me`, {
          headers: { 'Authorization': `Bearer ${tk.access_token}`, 'Accept': 'application/json', 'User-Agent': 'Typos ERP (suporte@typoserp.com.br)' },
        });
        userInfo = await ur.json();
      } catch (_) {}

      await admin.from('melhor_envio_connections').upsert({
        account_id: accountId,
        store_id: storeId || null,
        user_name: userInfo?.firstname ? `${userInfo.firstname} ${userInfo.lastname || ''}`.trim() : null,
        user_email: userInfo?.email || null,
        refresh_token: tk.refresh_token,
        access_token: tk.access_token,
        token_expires_at: new Date(Date.now() + (tk.expires_in || 3600) * 1000).toISOString(),
        is_active: true,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'account_id' });

      return redirectToApp(returnUrl, { me: 'connected' });
    }

    const body = await req.json();
    if (body.action === 'authorize') {
      const global = await loadGlobal(admin);
      if (!global) return jsonResponse({ error: 'Melhor Envio não configurado pelo Super Admin' }, 400);
      const h = hosts(!!global.is_sandbox);
      const state = encodeState({ accountId: body.accountId, storeId: body.storeId, returnUrl: body.returnUrl });
      const u = new URL(`${h.auth}/oauth/authorize`);
      u.searchParams.set('response_type', 'code');
      u.searchParams.set('client_id', global.client_id);
      u.searchParams.set('redirect_uri', getCallbackUrl(req, 'melhor-envio-connect'));
      u.searchParams.set('state', state);
      u.searchParams.set('scope', 'shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping cart-read cart-write orders-read');
      return jsonResponse({ authorize_url: u.toString() });
    }
    if (body.action === 'disconnect') {
      await admin.from('melhor_envio_connections').update({ is_active: false }).eq('id', body.connectionId);
      return jsonResponse({ success: true });
    }
    return jsonResponse({ error: 'invalid action' }, 400);
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
