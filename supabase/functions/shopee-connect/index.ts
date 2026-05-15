// Shopee Connect — OAuth real Shopee Open Platform (Brasil)
// Fluxo:
//   action: 'authorize' -> retorna URL de autorização (redireciona vendedor para Shopee)
//   action: 'callback'  -> troca o `code` + `shop_id` por access_token/refresh_token
//   action: 'disconnect'-> revoga conexão local
//   action: 'refresh'   -> renova access_token usando refresh_token
//
// Requer secrets: SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY
// Enquanto não estiverem configurados, cai em modo MOCK automaticamente
// (mantendo a UI funcional para demonstração).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { createHmac } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// === Endpoints Shopee Brasil (produção) ===
// Sandbox: https://partner.test-stable.shopeemobile.com
const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const AUTH_PATH = '/api/v2/shop/auth_partner';
const TOKEN_PATH = '/api/v2/auth/token/get';
const REFRESH_PATH = '/api/v2/auth/access_token/get';

function hmacSha256Hex(key: string, base: string): string {
  return createHmac('sha256', key).update(base).digest('hex');
}

// Assinatura para endpoints públicos (auth_partner / token/get): partner_id + path + timestamp
function publicSign(partnerId: string, partnerKey: string, path: string, ts: number): string {
  return hmacSha256Hex(partnerKey, `${partnerId}${path}${ts}`);
}

// Página HTML padronizada para resultados do callback (sucesso ou erro)
function callbackHtml(opts: { success: boolean; title: string; message: string; details?: string }): string {
  const color = opts.success ? '#10b981' : '#ef4444';
  const icon = opts.success ? '✓' : '!';
  const detailsBlock = opts.details
    ? `<div class="details">${opts.details.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as any)[c])}</div>`
    : '';
  const autoClose = opts.success
    ? `<script>setTimeout(()=>{try{window.close();}catch(_){}} ,2200);</script>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.success ? 'Loja Shopee conectada' : 'Não foi possível conectar'}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:linear-gradient(135deg,#fff7ed 0%,#fef3c7 100%);padding:24px;color:#0f172a}
  .card{max-width:460px;width:100%;background:#fff;border-radius:20px;padding:40px 32px;
        box-shadow:0 20px 60px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.04);text-align:center}
  .icon{width:72px;height:72px;border-radius:50%;background:${color};color:#fff;
        font-size:38px;font-weight:700;line-height:72px;margin:0 auto 20px;
        box-shadow:0 10px 24px ${color}55}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;color:#0f172a}
  p{font-size:15px;line-height:1.55;color:#475569;margin:0 0 20px}
  .details{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
           padding:12px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
           font-size:12px;color:#475569;text-align:left;word-break:break-word;margin-top:10px}
  .btn{display:inline-block;margin-top:18px;padding:11px 22px;border-radius:10px;
       background:#C45E1A;color:#fff;text-decoration:none;font-weight:600;font-size:14px;
       cursor:pointer;border:none;transition:transform .15s}
  .btn:hover{transform:translateY(-1px)}
</style></head>
<body><div class="card">
  <div class="icon">${icon}</div>
  <h1>${opts.title}</h1>
  <p>${opts.message}</p>
  ${detailsBlock}
  ${!opts.success ? '<button class="btn" onclick="window.close()">Fechar e tentar novamente</button>' : ''}
</div>${autoClose}</body></html>`;
}

// Traduz códigos comuns da Shopee para mensagens amigáveis
function humanShopeeError(code?: string, message?: string): { title: string; message: string } {
  switch (code) {
    case 'error_auth':
    case 'error_token':
      return { title: 'Sessão expirada', message: 'A autorização expirou antes de concluir. Clique em conectar novamente para começar do zero.' };
    case 'error_param':
      return { title: 'Parâmetros inválidos', message: 'A Shopee recusou os parâmetros enviados. Tente reconectar.' };
    case 'error_permission':
      return { title: 'Permissões insuficientes', message: 'Você precisa autorizar todas as permissões solicitadas durante o login.' };
    case 'error_inner':
    case 'error_server':
      return { title: 'Shopee instável', message: 'A Shopee está com lentidão neste momento. Tente novamente em alguns minutos.' };
    case 'error_signature':
      return { title: 'Credenciais incorretas', message: 'As credenciais Partner ID / Partner Key configuradas no super-admin estão inválidas. Avise o suporte.' };
    default:
      return {
        title: 'Não foi possível conectar',
        message: message || 'A Shopee retornou um erro inesperado. Tente reconectar.',
      };
  }
}

function getRedirectUrl(req: Request): string {
  // URL desta própria edge function (Shopee redireciona pra cá com ?code=&shop_id=)
  const url = new URL(req.url);
  return `${url.origin}/functions/v1/shopee-connect`;
}

async function loadShopeeCredentials(adminClient: any) {
  // 1) tenta buscar no banco (gerenciado pelo SuperAdmin)
  const { data } = await adminClient
    .from('integration_credentials')
    .select('key_name, key_value')
    .eq('provider', 'shopee');

  let partnerId = '';
  let partnerKey = '';
  if (data) {
    for (const row of data as Array<{ key_name: string; key_value: string }>) {
      if (row.key_name === 'partner_id') partnerId = row.key_value?.trim() || '';
      if (row.key_name === 'partner_key') partnerKey = row.key_value?.trim() || '';
    }
  }

  // 2) fallback para env (compatibilidade)
  if (!partnerId) partnerId = Deno.env.get('SHOPEE_PARTNER_ID') || '';
  if (!partnerKey) partnerKey = Deno.env.get('SHOPEE_PARTNER_KEY') || '';

  return { partnerId, partnerKey, hasCredentials: !!(partnerId && partnerKey) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const adminEarly = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { partnerId: PARTNER_ID, partnerKey: PARTNER_KEY, hasCredentials: HAS_CREDENTIALS } =
    await loadShopeeCredentials(adminEarly);

  try {
    // === GET: callback do Shopee (?code=&shop_id=&state=) ===
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      const shopIdParam = url.searchParams.get('shop_id');
      const state = url.searchParams.get('state'); // store_id que enviamos

      const htmlResponse = (html: string, status = 200) => new Response(html, {
        status, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });

      if (!code || !shopIdParam || !state) {
        return htmlResponse(callbackHtml({
          success: false,
          title: 'Link de autorização inválido',
          message: 'A Shopee não retornou os dados necessários. Volte ao ERP Typos! e clique em conectar novamente.',
        }), 400);
      }

      const admin = adminEarly;

      let access_token = 'mock_access_token';
      let refresh_token = 'mock_refresh_token';
      let expire_in = 4 * 60 * 60;
      let shop_name = 'Loja Shopee';

      if (HAS_CREDENTIALS) {
        const ts = Math.floor(Date.now() / 1000);
        const sign = publicSign(PARTNER_ID!, PARTNER_KEY!, TOKEN_PATH, ts);
        const tokenUrl = `${SHOPEE_HOST}${TOKEN_PATH}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`;

        const resp = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            shop_id: Number(shopIdParam),
            partner_id: Number(PARTNER_ID),
          }),
        });
        const data = await resp.json();

        if (data.error) {
          const human = humanShopeeError(data.error, data.message);
          return htmlResponse(callbackHtml({
            success: false, title: human.title, message: human.message,
            details: `Código: ${data.error}${data.message ? ` — ${data.message}` : ''}`,
          }), 400);
        }

        access_token = data.access_token;
        refresh_token = data.refresh_token;
        expire_in = data.expire_in || expire_in;

        // === Busca nome real da loja via /shop/get_shop_info ===
        try {
          const infoPath = '/api/v2/shop/get_shop_info';
          const infoTs = Math.floor(Date.now() / 1000);
          const infoSign = createHmac('sha256', PARTNER_KEY!)
            .update(`${PARTNER_ID}${infoPath}${infoTs}${access_token}${shopIdParam}`)
            .digest('hex');
          const infoUrl = `${SHOPEE_HOST}${infoPath}?partner_id=${PARTNER_ID}&timestamp=${infoTs}&sign=${infoSign}&access_token=${access_token}&shop_id=${shopIdParam}`;
          const infoResp = await fetch(infoUrl);
          const infoData = await infoResp.json();
          if (infoData?.shop_name) shop_name = infoData.shop_name;
        } catch (_) { /* mantém fallback */ }
      }

      const expiresAt = new Date(Date.now() + expire_in * 1000).toISOString();

      const { data: existing } = await admin
        .from('shopee_connections')
        .select('id, account_id')
        .eq('store_id', state)
        .maybeSingle();

      const payload: Record<string, unknown> = {
        shop_id: String(shopIdParam),
        shop_name,
        region: 'BR',
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        status: 'connected',
        is_mock: !HAS_CREDENTIALS,
        connected_at: new Date().toISOString(),
      };

      if (existing) {
        await admin.from('shopee_connections').update(payload).eq('id', existing.id);
      }

      return htmlResponse(callbackHtml({
        success: true,
        title: 'Loja Shopee conectada!',
        message: `${shop_name} foi vinculada ao seu ERP Typos!. Esta janela fecha automaticamente.`,
      }));
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
      await admin
        .from('shopee_connections')
        .update({
          status: 'disconnected',
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
        })
        .eq('store_id', store_id);

      return new Response(JSON.stringify({ success: true, status: 'disconnected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- AUTHORIZE: gera URL de autorização Shopee ----
    if (action === 'authorize' || !action) {
      // Garante registro pendente para receber o callback
      const { data: existing } = await admin
        .from('shopee_connections')
        .select('id')
        .eq('store_id', store_id)
        .maybeSingle();

      const baseRow = {
        account_id,
        store_id,
        status: 'pending',
        connected_by: userId,
        is_mock: !HAS_CREDENTIALS,
        region: 'BR',
      };

      if (existing) {
        await admin.from('shopee_connections').update(baseRow).eq('id', existing.id);
      } else {
        await admin.from('shopee_connections').insert(baseRow);
      }

      const redirect = getRedirectUrl(req);

      // === Fallback MOCK quando credenciais não estão configuradas ===
      if (!HAS_CREDENTIALS) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const mockShopId = `MOCK-${Math.floor(100000 + Math.random() * 900000)}`;
        await admin
          .from('shopee_connections')
          .update({
            shop_id: mockShopId,
            shop_name: 'Loja Shopee (Modo Demonstração)',
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            token_expires_at: expiresAt,
            status: 'connected',
            connected_at: new Date().toISOString(),
            is_mock: true,
          })
          .eq('store_id', store_id);

        return new Response(JSON.stringify({
          success: true,
          mock: true,
          shop_id: mockShopId,
          message: 'Modo demonstração — configure SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY para conexão real.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // === OAuth real Shopee ===
      const ts = Math.floor(Date.now() / 1000);
      const sign = publicSign(PARTNER_ID!, PARTNER_KEY!, AUTH_PATH, ts);
      const authUrl =
        `${SHOPEE_HOST}${AUTH_PATH}` +
        `?partner_id=${PARTNER_ID}` +
        `&timestamp=${ts}` +
        `&sign=${sign}` +
        `&redirect=${encodeURIComponent(`${redirect}?state=${store_id}`)}`;

      return new Response(JSON.stringify({
        success: true,
        mock: false,
        authorize_url: authUrl,
        message: 'Abra a URL para autorizar a loja na Shopee.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- REFRESH: renova access_token ----
    if (action === 'refresh') {
      if (!HAS_CREDENTIALS) {
        return new Response(JSON.stringify({ error: 'Credenciais Shopee não configuradas' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: conn } = await admin
        .from('shopee_connections')
        .select('id, shop_id, refresh_token')
        .eq('store_id', store_id)
        .maybeSingle();

      if (!conn?.refresh_token || !conn.shop_id) {
        return new Response(JSON.stringify({ error: 'Conexão não encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ts = Math.floor(Date.now() / 1000);
      const sign = publicSign(PARTNER_ID!, PARTNER_KEY!, REFRESH_PATH, ts);
      const refreshUrl = `${SHOPEE_HOST}${REFRESH_PATH}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`;

      const resp = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: conn.refresh_token,
          shop_id: Number(conn.shop_id),
          partner_id: Number(PARTNER_ID),
        }),
      });
      const data = await resp.json();

      if (data.error) {
        return new Response(JSON.stringify({ error: data.message || data.error }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const expiresAt = new Date(Date.now() + (data.expire_in || 14400) * 1000).toISOString();
      await admin.from('shopee_connections').update({
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
