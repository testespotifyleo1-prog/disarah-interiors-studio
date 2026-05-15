// Shopee Publish — chamadas REAIS na Shopee Open Platform Brasil
// Actions:
//   publish     -> upload de imagens + recomendação de categoria + /product/add_item
//   resync      -> /product/update_price + /product/update_stock
//   unpublish   -> /product/unlist_item (pausa anúncio) e remove o link local
//
// Renova access_token automaticamente quando vencido.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { createHmac } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const REFRESH_PATH = '/api/v2/auth/access_token/get';

function hmacHex(key: string, base: string): string {
  return createHmac('sha256', key).update(base).digest('hex');
}

// Endpoints de SHOP (privados): partner_id + path + timestamp + access_token + shop_id
function shopSign(partnerId: string, partnerKey: string, path: string, ts: number, token: string, shopId: string): string {
  return hmacHex(partnerKey, `${partnerId}${path}${ts}${token}${shopId}`);
}

function publicSign(partnerId: string, partnerKey: string, path: string, ts: number): string {
  return hmacHex(partnerKey, `${partnerId}${path}${ts}`);
}

function buildShopUrl(path: string, partnerId: string, partnerKey: string, token: string, shopId: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const sign = shopSign(partnerId, partnerKey, path, ts, token, shopId);
  return `${SHOPEE_HOST}${path}?partner_id=${partnerId}&timestamp=${ts}&sign=${sign}&access_token=${token}&shop_id=${shopId}`;
}

async function loadCredentials(admin: any) {
  const { data } = await admin
    .from('integration_credentials')
    .select('key_name, key_value')
    .eq('provider', 'shopee');
  let partnerId = '', partnerKey = '';
  if (data) for (const r of data as any[]) {
    if (r.key_name === 'partner_id') partnerId = (r.key_value || '').trim();
    if (r.key_name === 'partner_key') partnerKey = (r.key_value || '').trim();
  }
  if (!partnerId) partnerId = Deno.env.get('SHOPEE_PARTNER_ID') || '';
  if (!partnerKey) partnerKey = Deno.env.get('SHOPEE_PARTNER_KEY') || '';
  return { partnerId, partnerKey };
}

async function ensureFreshToken(admin: any, conn: any, partnerId: string, partnerKey: string) {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  // Renova se faltar menos de 5 min
  if (expiresAt - Date.now() > 5 * 60 * 1000) return conn.access_token;

  const ts = Math.floor(Date.now() / 1000);
  const sign = publicSign(partnerId, partnerKey, REFRESH_PATH, ts);
  const url = `${SHOPEE_HOST}${REFRESH_PATH}?partner_id=${partnerId}&timestamp=${ts}&sign=${sign}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: conn.refresh_token,
      shop_id: Number(conn.shop_id),
      partner_id: Number(partnerId),
    }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`Token expirado e não foi possível renovar: ${data.message || data.error}. Reconecte sua loja Shopee.`);

  const newExpires = new Date(Date.now() + (data.expire_in || 14400) * 1000).toISOString();
  await admin.from('shopee_connections').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: newExpires,
  }).eq('id', conn.id);

  return data.access_token as string;
}

// Traduz códigos comuns da Shopee para mensagens claras em pt-BR
function humanShopeeError(code?: string, message?: string): string {
  const m = (message || '').toLowerCase();
  switch (code) {
    case 'error_auth':
    case 'error_token':
    case 'error_param_token':
      return 'Sua sessão Shopee expirou. Reconecte sua loja em Integrações → Shopee.';
    case 'error_permission':
      return 'Sua conta Shopee não autorizou todas as permissões necessárias. Reconecte autorizando todos os escopos.';
    case 'error_param':
      return `Dados do produto inválidos para a Shopee: ${message || 'verifique título, peso, dimensões e estoque.'}`;
    case 'error_inner':
    case 'error_server':
      return 'A Shopee está temporariamente instável. Tente novamente em alguns minutos.';
    case 'error_category':
      return 'Categoria não pôde ser determinada automaticamente. Edite o produto e adicione uma descrição mais clara.';
    case 'error_logistics':
      return 'Configure pelo menos uma transportadora ativa no painel da Shopee antes de publicar.';
    case 'error_item_not_found':
      return 'Anúncio não existe mais na Shopee (pode ter sido removido manualmente).';
    case 'product.error_image_url_invalid':
    case 'product.error_image':
      return 'Uma das imagens do produto não pôde ser enviada para a Shopee. Verifique se as fotos estão acessíveis publicamente.';
    default:
      if (m.includes('shop is not active')) return 'Sua loja Shopee está inativa ou suspensa. Acesse o Seller Center para regularizar.';
      if (m.includes('not enough stock')) return 'Estoque insuficiente.';
      return message || code || 'Erro desconhecido da Shopee.';
  }
}

async function shopeeUploadImageByUrl(partnerId: string, partnerKey: string, imageUrl: string): Promise<string> {
  // /api/v2/media_space/upload_image_url (path público)
  const path = '/api/v2/media_space/upload_image_url';
  const ts = Math.floor(Date.now() / 1000);
  const sign = publicSign(partnerId, partnerKey, path, ts);
  const url = `${SHOPEE_HOST}${path}?partner_id=${partnerId}&timestamp=${ts}&sign=${sign}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url_list: [imageUrl] }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(humanShopeeError(data.error, data.message));
  const item = data.response?.image_info_list?.[0];
  if (!item || item.error) throw new Error(humanShopeeError(item?.error, item?.message || 'Falha ao enviar imagem'));
  return item.image_info?.image_id;
}

async function recommendCategory(partnerId: string, partnerKey: string, token: string, shopId: string, name: string): Promise<number | null> {
  const path = '/api/v2/product/category_recommend';
  const url = buildShopUrl(path, partnerId, partnerKey, token, shopId) + `&item_name=${encodeURIComponent(name)}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.error || !data.response?.category_id?.length) return null;
  return data.response.category_id[0];
}

async function getFirstLogistic(partnerId: string, partnerKey: string, token: string, shopId: string): Promise<number | null> {
  const path = '/api/v2/logistics/get_channel_list';
  const url = buildShopUrl(path, partnerId, partnerKey, token, shopId);
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.error) return null;
  const enabled = (data.response?.logistics_channel_list || []).find((l: any) => l.enabled);
  return enabled?.logistics_channel_id || null;
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const { action, account_id, connection_id, product_ids = [], product_id, link_id } = body;

    if (!action || !account_id || !connection_id) {
      return new Response(JSON.stringify({ error: 'action, account_id e connection_id são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { partnerId, partnerKey } = await loadCredentials(admin);
    if (!partnerId || !partnerKey) {
      return new Response(JSON.stringify({
        error: 'Credenciais Shopee não configuradas. O super-admin precisa cadastrar Partner ID e Partner Key.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: conn } = await admin
      .from('shopee_connections')
      .select('id, shop_id, store_id, access_token, refresh_token, token_expires_at, is_mock, status')
      .eq('id', connection_id)
      .maybeSingle();

    if (!conn || conn.status !== 'connected' || !conn.shop_id || !conn.access_token) {
      return new Response(JSON.stringify({
        error: 'Loja Shopee não está conectada. Conecte sua conta antes de publicar.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (conn.is_mock) {
      return new Response(JSON.stringify({
        error: 'Esta conexão está em modo demonstração. Reconecte para realizar publicação real.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = await ensureFreshToken(admin, conn, partnerId, partnerKey);

    // ===== UNPUBLISH =====
    if (action === 'unpublish') {
      if (!link_id) {
        return new Response(JSON.stringify({ error: 'link_id obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: link } = await admin
        .from('shopee_product_links')
        .select('id, shopee_item_id')
        .eq('id', link_id).maybeSingle();
      if (!link) {
        return new Response(JSON.stringify({ error: 'Link não encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // só chama API se for ID real
      if (link.shopee_item_id && !link.shopee_item_id.startsWith('MOCK')) {
        const path = '/api/v2/product/unlist_item';
        const url = buildShopUrl(path, partnerId, partnerKey, token, conn.shop_id);
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_list: [{ item_id: Number(link.shopee_item_id), unlist: true }],
          }),
        });
        const data = await resp.json();
        if (data.error && data.error !== 'error_item_not_found') {
          return new Response(JSON.stringify({ error: humanShopeeError(data.error, data.message) }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      await admin.from('shopee_product_links').delete().eq('id', link_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== RESYNC (preço + estoque) =====
    if (action === 'resync') {
      if (!link_id) {
        return new Response(JSON.stringify({ error: 'link_id obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: link } = await admin
        .from('shopee_product_links')
        .select('id, product_id, shopee_item_id, shopee_price')
        .eq('id', link_id).maybeSingle();
      if (!link?.shopee_item_id || link.shopee_item_id.startsWith('MOCK')) {
        return new Response(JSON.stringify({
          error: 'Este produto foi publicado em modo demonstração. Use Republicar para enviar de verdade.',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // estoque atual
      const { data: invs } = await admin
        .from('inventory').select('qty_on_hand')
        .eq('store_id', conn.store_id).eq('product_id', link.product_id);
      const stock = (invs || []).reduce((s: number, r: any) => s + Number(r.qty_on_hand || 0), 0);

      // preço atual (do produto)
      const { data: prod } = await admin
        .from('products').select('price_default').eq('id', link.product_id).maybeSingle();
      const price = Number(prod?.price_default || link.shopee_price || 0);

      // update price
      const pricePath = '/api/v2/product/update_price';
      const priceUrl = buildShopUrl(pricePath, partnerId, partnerKey, token, conn.shop_id);
      const priceResp = await fetch(priceUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: Number(link.shopee_item_id),
          price_list: [{ model_id: 0, original_price: price }],
        }),
      });
      const priceData = await priceResp.json();
      if (priceData.error) {
        await admin.from('shopee_product_links').update({
          sync_status: 'error', sync_error: humanShopeeError(priceData.error, priceData.message),
        }).eq('id', link_id);
        return new Response(JSON.stringify({ error: humanShopeeError(priceData.error, priceData.message) }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // update stock
      const stockPath = '/api/v2/product/update_stock';
      const stockUrl = buildShopUrl(stockPath, partnerId, partnerKey, token, conn.shop_id);
      const stockResp = await fetch(stockUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: Number(link.shopee_item_id),
          stock_list: [{ model_id: 0, normal_stock: Math.max(0, stock) }],
        }),
      });
      const stockData = await stockResp.json();
      if (stockData.error) {
        await admin.from('shopee_product_links').update({
          sync_status: 'error', sync_error: humanShopeeError(stockData.error, stockData.message),
        }).eq('id', link_id);
        return new Response(JSON.stringify({ error: humanShopeeError(stockData.error, stockData.message) }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await admin.from('shopee_product_links').update({
        sync_status: 'published', sync_error: null,
        shopee_price: price, last_synced_at: new Date().toISOString(),
      }).eq('id', link_id);

      return new Response(JSON.stringify({ success: true, price, stock }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== PUBLISH (cria item REAL) =====
    if (action === 'publish') {
      const ids: string[] = product_ids.length ? product_ids : (product_id ? [product_id] : []);
      if (!ids.length) {
        return new Response(JSON.stringify({ error: 'Nenhum produto selecionado' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // logística padrão (precisa pelo menos uma habilitada na conta)
      const logisticId = await getFirstLogistic(partnerId, partnerKey, token, conn.shop_id);
      if (!logisticId) {
        return new Response(JSON.stringify({
          error: 'Você precisa habilitar pelo menos uma transportadora no Seller Center da Shopee antes de publicar.',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const results: Array<{ product_id: string; success: boolean; item_id?: number; error?: string }> = [];

      for (const pid of ids) {
        try {
          const { data: prod } = await admin
            .from('products')
            .select('id, name, description, price_default, weight_grams, image_url, sku, brand')
            .eq('id', pid).maybeSingle();
          if (!prod) { results.push({ product_id: pid, success: false, error: 'Produto não encontrado' }); continue; }

          const name = String(prod.name || '').slice(0, 120).trim();
          if (name.length < 3) { results.push({ product_id: pid, success: false, error: 'Título do produto muito curto (mín 3 caracteres)' }); continue; }
          if (!prod.image_url) { results.push({ product_id: pid, success: false, error: 'Produto sem imagem principal' }); continue; }

          const { data: invs } = await admin
            .from('inventory').select('qty_on_hand')
            .eq('store_id', conn.store_id).eq('product_id', pid);
          const stock = (invs || []).reduce((s: number, r: any) => s + Number(r.qty_on_hand || 0), 0);
          if (stock <= 0) { results.push({ product_id: pid, success: false, error: 'Estoque zerado' }); continue; }

          // marca como publishing
          await admin.from('shopee_product_links').upsert({
            account_id, connection_id, product_id: pid,
            shopee_price: Number(prod.price_default || 0),
            sync_status: 'publishing', sync_error: null, created_by: userId,
          }, { onConflict: 'connection_id,product_id' });

          // 1) upload imagem principal
          const imageId = await shopeeUploadImageByUrl(partnerId, partnerKey, prod.image_url);

          // 2) categoria recomendada
          const categoryId = await recommendCategory(partnerId, partnerKey, token, conn.shop_id, name);
          if (!categoryId) {
            const msg = 'Categoria Shopee não pôde ser determinada automaticamente. Edite o nome do produto deixando-o mais descritivo (ex: "Camiseta básica algodão branca").';
            await admin.from('shopee_product_links').update({ sync_status: 'error', sync_error: msg })
              .eq('connection_id', connection_id).eq('product_id', pid);
            results.push({ product_id: pid, success: false, error: msg });
            continue;
          }

          // 3) cria item
          const path = '/api/v2/product/add_item';
          const url = buildShopUrl(path, partnerId, partnerKey, token, conn.shop_id);
          const payload = {
            original_price: Number(prod.price_default || 0),
            description: (prod.description || prod.name || '').slice(0, 3000),
            weight: Math.max(0.01, Number(prod.weight_grams || 200) / 1000), // kg
            item_name: name,
            item_status: 'NORMAL',
            dimension: { package_length: 20, package_width: 15, package_height: 10 },
            normal_stock: stock,
            logistic_info: [{ logistic_id: logisticId, enabled: true }],
            category_id: categoryId,
            image: { image_id_list: [imageId] },
            seller_stock: [{ stock }],
            ...(prod.sku ? { item_sku: String(prod.sku).slice(0, 100) } : {}),
          };
          const resp = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await resp.json();
          if (data.error) {
            const msg = humanShopeeError(data.error, data.message);
            await admin.from('shopee_product_links').update({ sync_status: 'error', sync_error: msg })
              .eq('connection_id', connection_id).eq('product_id', pid);
            results.push({ product_id: pid, success: false, error: msg });
            continue;
          }

          const itemId = data.response?.item_id;
          await admin.from('shopee_product_links').update({
            sync_status: 'published', sync_error: null,
            shopee_item_id: String(itemId), last_synced_at: new Date().toISOString(),
          }).eq('connection_id', connection_id).eq('product_id', pid);

          results.push({ product_id: pid, success: true, item_id: itemId });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro desconhecido';
          await admin.from('shopee_product_links').update({ sync_status: 'error', sync_error: msg })
            .eq('connection_id', connection_id).eq('product_id', pid);
          results.push({ product_id: pid, success: false, error: msg });
        }
      }

      const okCount = results.filter(r => r.success).length;
      return new Response(JSON.stringify({
        success: okCount > 0, total: results.length, published: okCount, results,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
