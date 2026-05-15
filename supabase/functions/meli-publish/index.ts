// Mercado Livre Publish — publica/atualiza produtos reais via API ML
// Ações:
//   action: 'publish'   { account_id, store_id, product_ids: [] }   -> cria itens no ML
//   action: 'resync'    { account_id, store_id, link_id }           -> re-envia preço/estoque
//   action: 'unpublish' { account_id, store_id, link_id }           -> pausa anúncio no ML
//
// Requer integration_credentials provider='mercadolivre' (app_id, client_secret)
// e meli_connections.status='connected' com access_token válido.
// Faz refresh automático do token se expirado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_API = 'https://api.mercadolibre.com';

type AdminClient = ReturnType<typeof createClient>;

async function loadCredentials(admin: AdminClient) {
  const { data } = await admin
    .from('integration_credentials')
    .select('key_name, key_value')
    .eq('provider', 'mercadolivre');
  let appId = '', clientSecret = '';
  for (const r of (data as any[] || [])) {
    if (r.key_name === 'app_id') appId = (r.key_value || '').trim();
    if (r.key_name === 'client_secret') clientSecret = (r.key_value || '').trim();
  }
  return { appId, clientSecret };
}

async function ensureFreshToken(admin: AdminClient, conn: any, appId: string, clientSecret: string) {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  // Renova se faltam menos de 5 min
  if (expiresAt - Date.now() > 5 * 60 * 1000) return conn.access_token;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: appId,
    client_secret: clientSecret,
    refresh_token: conn.refresh_token,
  });
  const r = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: body.toString(),
  });
  const data = await r.json();
  if (!r.ok || data.error) {
    throw new Error('Falha ao renovar token Mercado Livre: ' + (data.message || data.error_description || data.error));
  }
  const newExp = new Date(Date.now() + (data.expires_in || 21600) * 1000).toISOString();
  await admin.from('meli_connections').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: newExp,
  }).eq('id', conn.id);
  return data.access_token as string;
}

async function predictCategory(token: string, title: string): Promise<string | null> {
  try {
    const url = `${ML_API}/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(title.slice(0, 100))}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const data = await r.json();
    if (Array.isArray(data) && data[0]?.category_id) return data[0].category_id;
  } catch (_) { /* ignore */ }
  return null;
}

async function publishOne(args: {
  admin: AdminClient;
  token: string;
  accountId: string;
  storeId: string;
  connectionId: string;
  productId: string;
  meliPriceOverride?: number | null;
}): Promise<{ ok: true; meli_item_id: string } | { ok: false; error: string }> {
  const { admin, token, accountId, storeId, connectionId, productId, meliPriceOverride } = args;

  // Carrega produto + imagens + estoque
  const { data: product, error: prodErr } = await admin
    .from('products')
    .select('id, name, description, description_long, image_url, price_default, gtin, brand')
    .eq('id', productId)
    .maybeSingle();
  if (prodErr || !product) return { ok: false, error: 'Produto não encontrado' };

  const { data: imgs } = await admin
    .from('product_images')
    .select('image_url, sort_order')
    .eq('product_id', productId)
    .order('sort_order');

  const { data: invRows } = await admin
    .from('inventory')
    .select('qty_on_hand')
    .eq('store_id', storeId)
    .eq('product_id', productId);
  const qty = Math.max(0, Math.floor((invRows || []).reduce((s, r: any) => s + Number(r.qty_on_hand || 0), 0)));

  if (qty < 1) return { ok: false, error: 'Estoque zerado — abasteça antes de publicar.' };

  const pictures: { source: string }[] = [];
  if (product.image_url) pictures.push({ source: product.image_url });
  for (const i of (imgs || []) as any[]) {
    if (i.image_url && !pictures.find(p => p.source === i.image_url)) pictures.push({ source: i.image_url });
  }
  if (pictures.length === 0) return { ok: false, error: 'Adicione ao menos 1 imagem ao produto.' };

  const title = String(product.name || '').slice(0, 60).trim();
  if (title.length < 3) return { ok: false, error: 'Nome do produto inválido.' };

  const price = Number(meliPriceOverride ?? product.price_default ?? 0);
  if (!(price > 0)) return { ok: false, error: 'Preço inválido.' };

  const description = (product.description_long || product.description || product.name || '').slice(0, 50000);

  const categoryId = await predictCategory(token, title);
  if (!categoryId) return { ok: false, error: 'Não conseguimos identificar a categoria no Mercado Livre. Ajuste o título do produto.' };

  const attributes: any[] = [];
  if (product.brand) attributes.push({ id: 'BRAND', value_name: String(product.brand) });
  if (product.gtin) attributes.push({ id: 'GTIN', value_name: String(product.gtin) });

  const payload: any = {
    title,
    category_id: categoryId,
    price,
    currency_id: 'BRL',
    available_quantity: qty,
    buying_mode: 'buy_it_now',
    condition: 'new',
    listing_type_id: 'gold_special',
    description: { plain_text: description },
    pictures,
    attributes,
  };

  const r = await fetch(`${ML_API}/items`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json();

  if (!r.ok) {
    let msg = data?.message || data?.error || 'Erro desconhecido na API do Mercado Livre';
    const causeMsg = Array.isArray(data?.cause) && data.cause[0]?.message ? data.cause[0].message : '';
    const causeCode = Array.isArray(data?.cause) && data.cause[0]?.code ? String(data.cause[0].code) : '';
    const allText = `${msg} ${causeMsg} ${causeCode}`.toLowerCase();

    // Traduções para erros comuns do ML
    if (allText.includes('seller.unable_to_list') || allText.includes('unable_to_list')) {
      msg = 'Sua conta no Mercado Livre ainda não está habilitada para publicar anúncios. Acesse mercadolivre.com.br, complete o cadastro de vendedor (dados fiscais, endereço, dados bancários) e publique 1 anúncio manualmente pelo site. Depois tente novamente aqui.';
    } else if (allText.includes('invalid_token') || allText.includes('expired')) {
      msg = 'Token expirado. Reconecte sua conta Mercado Livre na tela de integração.';
    } else if (allText.includes('forbidden') || allText.includes('scope')) {
      msg = 'Sua conta não tem permissão de escrita (write). Reconecte autorizando todos os escopos solicitados.';
    } else if (causeMsg) {
      msg = `${msg} — ${causeMsg}`;
    }

    await admin.from('meli_product_links').upsert({
      account_id: accountId,
      connection_id: connectionId,
      product_id: productId,
      meli_price: price,
      sync_status: 'error',
      sync_error: msg.slice(0, 500),
    }, { onConflict: 'connection_id,product_id' });
    return { ok: false, error: msg };
  }

  await admin.from('meli_product_links').upsert({
    account_id: accountId,
    connection_id: connectionId,
    product_id: productId,
    meli_item_id: data.id,
    meli_price: price,
    sync_status: 'published',
    sync_error: null,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: 'connection_id,product_id' });

  return { ok: true, meli_item_id: data.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action, account_id, store_id, product_ids, link_id } = body;

    if (!account_id || !store_id) {
      return new Response(JSON.stringify({ error: 'account_id e store_id obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: conn } = await admin
      .from('meli_connections')
      .select('id, account_id, store_id, status, is_mock, access_token, refresh_token, token_expires_at')
      .eq('account_id', account_id)
      .eq('store_id', store_id)
      .maybeSingle();

    if (!conn || conn.status !== 'connected' || !conn.access_token) {
      return new Response(JSON.stringify({ error: 'Loja não está conectada ao Mercado Livre. Conecte primeiro.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (conn.is_mock) {
      return new Response(JSON.stringify({ error: 'Esta conexão está em modo demonstração. Conecte uma conta real do Mercado Livre.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { appId, clientSecret } = await loadCredentials(admin);
    if (!appId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Credenciais Mercado Livre não configuradas no Super Admin.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = await ensureFreshToken(admin, conn, appId, clientSecret);

    // ========= PUBLISH (lote) =========
    if (action === 'publish') {
      const ids: string[] = Array.isArray(product_ids) ? product_ids.filter(Boolean) : [];
      if (ids.length === 0) {
        return new Response(JSON.stringify({ error: 'product_ids vazio' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Marca todos como publishing
      for (const pid of ids) {
        await admin.from('meli_product_links').upsert({
          account_id, connection_id: conn.id, product_id: pid,
          sync_status: 'publishing', sync_error: null, created_by: u.user.id,
        }, { onConflict: 'connection_id,product_id' });
      }

      const results: Array<{ product_id: string; ok: boolean; meli_item_id?: string; error?: string }> = [];
      for (const pid of ids) {
        const res = await publishOne({
          admin, token, accountId: account_id, storeId: store_id,
          connectionId: conn.id, productId: pid,
        });
        if (res.ok) results.push({ product_id: pid, ok: true, meli_item_id: res.meli_item_id });
        else results.push({ product_id: pid, ok: false, error: res.error });
      }

      const ok = results.filter(r => r.ok).length;
      const fail = results.length - ok;
      await admin.from('meli_connections').update({ last_sync_at: new Date().toISOString() }).eq('id', conn.id);

      return new Response(JSON.stringify({ success: true, published: ok, failed: fail, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========= RESYNC (preço + estoque) =========
    if (action === 'resync') {
      if (!link_id) {
        return new Response(JSON.stringify({ error: 'link_id obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: link } = await admin.from('meli_product_links').select('*').eq('id', link_id).maybeSingle();
      if (!link) {
        return new Response(JSON.stringify({ error: 'Vínculo não encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Se ainda não tem item ML real, faz publish
      if (!link.meli_item_id || link.meli_item_id.startsWith('MOCK-')) {
        const res = await publishOne({
          admin, token, accountId: account_id, storeId: store_id,
          connectionId: conn.id, productId: link.product_id,
        });
        return new Response(JSON.stringify(res), {
          status: res.ok ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: prod } = await admin.from('products').select('price_default').eq('id', link.product_id).maybeSingle();
      const { data: invRows } = await admin.from('inventory').select('qty_on_hand').eq('store_id', store_id).eq('product_id', link.product_id);
      const qty = Math.max(0, Math.floor((invRows || []).reduce((s, r: any) => s + Number(r.qty_on_hand || 0), 0)));

      const price = Number(link.meli_price ?? prod?.price_default ?? 0);
      const r = await fetch(`${ML_API}/items/${link.meli_item_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ price, available_quantity: qty }),
      });
      const data = await r.json();
      if (!r.ok) {
        const msg = data?.message || data?.error || 'Erro ao atualizar';
        await admin.from('meli_product_links').update({
          sync_status: 'error', sync_error: msg,
        }).eq('id', link_id);
        return new Response(JSON.stringify({ error: msg }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await admin.from('meli_product_links').update({
        sync_status: 'published', sync_error: null, last_synced_at: new Date().toISOString(),
      }).eq('id', link_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========= UNPUBLISH (pausa) =========
    if (action === 'unpublish') {
      if (!link_id) {
        return new Response(JSON.stringify({ error: 'link_id obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: link } = await admin.from('meli_product_links').select('*').eq('id', link_id).maybeSingle();
      if (link?.meli_item_id && !link.meli_item_id.startsWith('MOCK-')) {
        await fetch(`${ML_API}/items/${link.meli_item_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'paused' }),
        });
      }
      await admin.from('meli_product_links').delete().eq('id', link_id);
      return new Response(JSON.stringify({ success: true }), {
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
