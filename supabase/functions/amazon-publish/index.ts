// Amazon SP-API Publish — publica produto no catálogo Amazon Brasil
// Docs Listings: https://developer-docs.amazon.com/sp-api/docs/listings-items-api-v2021-08-01-reference
// Docs Product Type: https://developer-docs.amazon.com/sp-api/docs/product-type-definitions-api-v2020-09-01-reference
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

const SPAPI_HOST = 'https://sellingpartnerapi-na.amazon.com';

async function ensureAccessToken(admin: ReturnType<typeof createClient>, conn: any, global: any) {
  if (conn.token_expires_at && new Date(conn.token_expires_at) > new Date(Date.now() + 60000)) return conn.access_token;
  const r = await fetch('https://api.amazon.com/auth/o2/token', {
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
  if (!r.ok) throw new Error(tk?.error_description || 'failed to refresh');
  await admin.from('amazon_connections').update({
    access_token: tk.access_token,
    token_expires_at: new Date(Date.now() + (tk.expires_in || 3600) * 1000).toISOString(),
  }).eq('id', conn.id);
  return tk.access_token;
}

async function lookupProductType(token: string, marketplaceId: string, keyword: string): Promise<string> {
  try {
    const u = new URL(`${SPAPI_HOST}/definitions/2020-09-01/productTypes`);
    u.searchParams.set('marketplaceIds', marketplaceId);
    u.searchParams.set('keywords', keyword.slice(0, 100));
    const r = await fetch(u.toString(), { headers: { 'x-amz-access-token': token, 'Accept': 'application/json' } });
    if (!r.ok) return 'PRODUCT';
    const j = await r.json();
    return j?.productTypes?.[0]?.name || 'PRODUCT';
  } catch { return 'PRODUCT'; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { accountId, productId } = await req.json();
    if (!accountId || !productId) return jsonResponse({ error: 'accountId/productId requeridos' }, 400);

    const { data: conn } = await admin.from('amazon_connections').select('*').eq('account_id', accountId).eq('is_active', true).maybeSingle();
    if (!conn) return jsonResponse({ error: 'Conta não conectada à Amazon' }, 400);

    const { data: global } = await admin.from('amazon_global_credentials').select('*').eq('is_active', true).maybeSingle();
    if (!global) return jsonResponse({ error: 'Credenciais globais ausentes' }, 400);

    const { data: product } = await admin.from('products').select('*').eq('id', productId).maybeSingle();
    if (!product) return jsonResponse({ error: 'Produto não encontrado' }, 404);

    const token = await ensureAccessToken(admin, conn, global);
    const sku = product.sku || product.id;

    // Descobre productType correto via Product Type Definitions API
    const productType = await lookupProductType(token, global.marketplace_id, `${product.name} ${product.category || ''}`.trim());

    const payload = {
      productType,
      requirements: 'LISTING',
      attributes: {
        item_name: [{ value: product.name, language_tag: 'pt_BR', marketplace_id: global.marketplace_id }],
        brand: [{ value: product.brand || 'Genérico', language_tag: 'pt_BR', marketplace_id: global.marketplace_id }],
        product_description: [{ value: product.description || product.name, language_tag: 'pt_BR', marketplace_id: global.marketplace_id }],
        purchasable_offer: [{
          currency: 'BRL',
          marketplace_id: global.marketplace_id,
          our_price: [{ schedule: [{ value_with_tax: Number(product.price || 0) }] }],
        }],
        fulfillment_availability: [{
          fulfillment_channel_code: 'DEFAULT',
          quantity: Number(product.stock_qty || 1),
          marketplace_id: global.marketplace_id,
        }],
        condition_type: [{ value: 'new_new', marketplace_id: global.marketplace_id }],
      },
    };

    const r = await fetch(`${SPAPI_HOST}/listings/2021-08-01/items/${conn.seller_id}/${encodeURIComponent(sku)}?marketplaceIds=${global.marketplace_id}`, {
      method: 'PUT',
      headers: {
        'x-amz-access-token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const result = await r.json();
    if (!r.ok) {
      console.error('[amazon-publish] error', r.status, JSON.stringify(result).slice(0, 800));
      return jsonResponse({ error: result, productType, hint: result?.errors?.[0]?.message || 'verifique productType e atributos obrigatórios' }, r.status);
    }

    return jsonResponse({ success: true, sku, productType, submission_id: result?.submissionId, status: result?.status, result });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
