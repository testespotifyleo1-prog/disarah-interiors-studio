// Mercado Livre Connect — OAuth real Mercado Libre Developers
// Fluxo:
//   action: 'authorize' -> retorna URL de autorização (redireciona vendedor para o ML)
//   GET callback        -> troca o `code` por access_token/refresh_token
//   action: 'disconnect'-> revoga conexão local
//   action: 'refresh'   -> renova access_token usando refresh_token
//
// Requer credenciais globais em integration_credentials (provider='mercadolivre'):
//   key_name='app_id'
//   key_name='client_secret'
// Enquanto não estiverem configuradas, cai em modo MOCK automaticamente,
// mantendo a UI funcional para demonstração.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// === Endpoints Mercado Livre ===
const ML_AUTH_HOST = 'https://auth.mercadolivre.com.br'; // Brasil
const ML_API_HOST = 'https://api.mercadolibre.com';
const AUTH_PATH = '/authorization';
const TOKEN_PATH = '/oauth/token';
const USER_ME_PATH = '/users/me';

function getRedirectUrl(req: Request): string {
  // Sempre HTTPS — Mercado Livre exige. Prioriza SUPABASE_URL para evitar host interno.
  const supaUrl = Deno.env.get('SUPABASE_URL');
  if (supaUrl) return `${supaUrl.replace(/\/$/, '')}/functions/v1/meli-connect`;
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || url.host;
  return `https://${host}/functions/v1/meli-connect`;
}

function encodeOAuthState(storeId: string, returnUrl: string): string {
  const raw = JSON.stringify({ store_id: storeId, return_url: returnUrl });
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeOAuthState(state: string): { storeId: string; returnUrl: string } {
  try {
    const padded = state.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - state.length % 4) % 4);
    const parsed = JSON.parse(atob(padded));
    if (parsed?.store_id) {
      return {
        storeId: String(parsed.store_id),
        returnUrl: String(parsed.return_url || 'https://typoserp.com.br/meli/callback'),
      };
    }
  } catch (_) {
    // Compatibilidade com links antigos: state era apenas o store_id.
  }
  return { storeId: state, returnUrl: 'https://typoserp.com.br/meli/callback' };
}

function redirectToApp(returnUrl: string, params: Record<string, string>) {
  const url = new URL(returnUrl || 'https://typoserp.com.br/meli/callback');
  const allowedHost = url.hostname === 'typoserp.com.br' || url.hostname.endsWith('.lovable.app') || url.hostname === 'localhost';
  if (!allowedHost) return redirectToApp('https://typoserp.com.br/meli/callback', params);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return Response.redirect(url.toString(), 302);
}

async function loadMeliCredentials(adminClient: ReturnType<typeof createClient>) {
  const { data } = await adminClient
    .from('integration_credentials')
    .select('key_name, key_value')
    .eq('provider', 'mercadolivre');

  let appId = '';
  let clientSecret = '';
  if (data) {
    for (const row of data as Array<{ key_name: string; key_value: string }>) {
      if (row.key_name === 'app_id') appId = row.key_value?.trim() || '';
      if (row.key_name === 'client_secret') clientSecret = row.key_value?.trim() || '';
    }
  }

  // fallback opcional para env
  if (!appId) appId = Deno.env.get('MERCADOLIVRE_APP_ID') || '';
  if (!clientSecret) clientSecret = Deno.env.get('MERCADOLIVRE_CLIENT_SECRET') || '';

  return { appId, clientSecret, hasCredentials: !!(appId && clientSecret) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const adminEarly = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { appId: APP_ID, clientSecret: CLIENT_SECRET, hasCredentials: HAS_CREDENTIALS } =
    await loadMeliCredentials(adminEarly);

  try {
    // === GET: callback do Mercado Livre (?code=&state=) ===
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state'); // store_id
      const error = url.searchParams.get('error');
      const decodedState = state ? decodeOAuthState(state) : null;

      if (error) {
        return redirectToApp(decodedState?.returnUrl || 'https://typoserp.com.br/meli/callback', {
          status: 'error',
          message: `Mercado Livre retornou: ${error}`,
        });
      }
      if (!code || !state) {
        return redirectToApp('https://typoserp.com.br/meli/callback', {
          status: 'error',
          message: 'A autorização voltou sem as informações necessárias.',
        });
      }

      const admin = adminEarly;
      const redirect = getRedirectUrl(req);
      const storeId = decodedState?.storeId || state;
      const returnUrl = decodedState?.returnUrl || 'https://typoserp.com.br/meli/callback';

      let access_token = 'mock_access_token';
      let refresh_token = 'mock_refresh_token';
      let expires_in = 6 * 60 * 60; // 6h padrão ML
      let meli_user_id = '';
      let nickname = 'Loja Mercado Livre';

      if (HAS_CREDENTIALS) {
        // Trocar code por tokens
        const tokenBody = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: APP_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: redirect,
        });

        const tokenResp = await fetch(`${ML_API_HOST}${TOKEN_PATH}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: tokenBody.toString(),
        });
        const tokenData = await tokenResp.json();

        if (!tokenResp.ok || tokenData.error) {
          return redirectToApp(returnUrl, {
            status: 'error',
            message: tokenData.message || tokenData.error_description || 'Mercado Livre não autorizou a conexão.',
          });
        }

        access_token = tokenData.access_token;
        refresh_token = tokenData.refresh_token;
        expires_in = tokenData.expires_in || expires_in;
        meli_user_id = String(tokenData.user_id || '');

        // Buscar dados do vendedor
        if (access_token) {
          const meResp = await fetch(`${ML_API_HOST}${USER_ME_PATH}`, {
            headers: { Authorization: `Bearer ${access_token}` },
          });
          if (meResp.ok) {
            const me = await meResp.json();
            nickname = me.nickname || nickname;
            if (!meli_user_id) meli_user_id = String(me.id || '');
          }
        }
      }

      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

      const { data: existing } = await admin
        .from('meli_connections')
        .select('id')
        .eq('store_id', storeId)
        .maybeSingle();

      const payload: Record<string, unknown> = {
        meli_user_id: meli_user_id || null,
        nickname,
        site_id: 'MLB',
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        status: 'connected',
        is_mock: !HAS_CREDENTIALS,
        connected_at: new Date().toISOString(),
      };

      if (existing) {
        await admin.from('meli_connections').update(payload).eq('id', existing.id);
      }

      return redirectToApp(returnUrl, {
        status: 'success',
        nickname,
      });
    }

    // === POST: ações vindas do app autenticado ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Usuário inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { account_id, store_id, action } = body;

    if (!account_id || !store_id) {
      return new Response(JSON.stringify({ error: 'account_id e store_id obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ---- DISCONNECT ----
    if (action === 'disconnect') {
      const { error: disconnectError } = await admin
        .from('meli_connections')
        .update({
          status: 'disconnected',
          meli_user_id: null,
          nickname: null,
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          connected_at: null,
        })
        .eq('account_id', account_id)
        .eq('store_id', store_id);

      if (disconnectError) {
        return new Response(JSON.stringify({ error: disconnectError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, status: 'disconnected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- AUTHORIZE: gera URL de autorização Mercado Livre ----
    if (action === 'authorize' || !action) {
      const { data: existing } = await admin
        .from('meli_connections')
        .select('id')
        .eq('account_id', account_id)
        .eq('store_id', store_id)
        .maybeSingle();

      const baseRow = {
        account_id,
        store_id,
        status: 'pending',
        meli_user_id: null,
        nickname: null,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        connected_at: null,
        connected_by: userId,
        is_mock: !HAS_CREDENTIALS,
        site_id: 'MLB',
      };

      if (existing) {
        await admin.from('meli_connections').update(baseRow).eq('id', existing.id);
      } else {
        await admin.from('meli_connections').insert(baseRow);
      }

      const redirect = getRedirectUrl(req);
      const origin = req.headers.get('origin') || 'https://typoserp.com.br';
      const returnUrl = `${origin.replace(/\/$/, '')}/meli/callback`;
      const oauthState = encodeOAuthState(store_id, returnUrl);

      // === Fallback MOCK quando credenciais não estão configuradas ===
      if (!HAS_CREDENTIALS) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const mockUserId = `MOCK-${Math.floor(100000 + Math.random() * 900000)}`;
        await admin
          .from('meli_connections')
          .update({
            meli_user_id: mockUserId,
            nickname: 'Loja ML (Modo Demonstração)',
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            token_expires_at: expiresAt,
            status: 'connected',
            connected_at: new Date().toISOString(),
            is_mock: true,
          })
          .eq('account_id', account_id)
          .eq('store_id', store_id);

        return new Response(JSON.stringify({
          success: true,
          mock: true,
          meli_user_id: mockUserId,
          message: 'Modo demonstração — configure App ID e Client Secret no Super Admin para conexão real.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // === OAuth real Mercado Livre ===
      const authUrl =
        `${ML_AUTH_HOST}${AUTH_PATH}` +
        `?response_type=code` +
        `&client_id=${encodeURIComponent(APP_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirect)}` +
        `&state=${encodeURIComponent(oauthState)}`;

      return new Response(JSON.stringify({
        success: true,
        mock: false,
        authorize_url: authUrl,
        message: 'Abra a URL para autorizar a loja no Mercado Livre.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- REFRESH: renova access_token ----
    if (action === 'refresh') {
      if (!HAS_CREDENTIALS) {
        return new Response(JSON.stringify({ error: 'Credenciais Mercado Livre não configuradas' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: conn } = await admin
        .from('meli_connections')
        .select('id, refresh_token')
        .eq('store_id', store_id)
        .maybeSingle();

      if (!conn?.refresh_token) {
        return new Response(JSON.stringify({ error: 'Conexão não encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refreshBody = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: APP_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: conn.refresh_token,
      });

      const resp = await fetch(`${ML_API_HOST}${TOKEN_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: refreshBody.toString(),
      });
      const data = await resp.json();

      if (!resp.ok || data.error) {
        return new Response(JSON.stringify({ error: data.message || data.error_description || data.error }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const expiresAt = new Date(Date.now() + (data.expires_in || 21600) * 1000).toISOString();
      await admin.from('meli_connections').update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_expires_at: expiresAt,
      }).eq('id', conn.id);

      return new Response(JSON.stringify({ success: true, token_expires_at: expiresAt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
