// Magalu Publish — envia produto pro catálogo Magalu Marketplace
// Docs: https://developer.luizalabs.com/api-product/api-marketplace
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, jsonResponse } from '../_shared/integrations.ts';

async function ensureToken(admin: ReturnType<typeof createClient>, conn: any, global: any) {
  if (conn.token_expires_at && new Date(conn.token_expires_at) > new Date(Date.now() + 60000)) return conn.access_token;
  const r = await fetch('https://id.magalu.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
      client_id: global.client_id,
      client_secret: global.client_secret,
    }),
  });
  const tk = await r.json();
  if (!r.ok) throw new Error(tk?.error_description || tk?.error || 'magalu refresh failed');
  await admin.from('magalu_connections').update({
    access_token: tk.access_token,
    refresh_token: tk.refresh_token || conn.refresh_token,
    token_expires_at: new Date(Date.now() + (tk.expires_in || 3600) * 1000).toISOString(),
  }).eq('id', conn.id);
  return tk.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { accountId, productId } = await req.json();

    const { data: conn } = await admin.from('magalu_connections').select('*').eq('account_id', accountId).eq('is_active', true).maybeSingle();
    if (!conn) return jsonResponse({ error: 'Não conectado ao Magalu' }, 400);
    const { data: global } = await admin.from('magalu_global_credentials').select('*').eq('is_active', true).maybeSingle();
    if (!global) return jsonResponse({ error: 'Credenciais globais ausentes' }, 400);
    if (!global.api_base_url) return jsonResponse({ error: 'api_base_url não configurada no Super Admin (ex.: https://api.magalu.com/marketplace/v1)' }, 400);

    const { data: product } = await admin.from('products').select('*').eq('id', productId).maybeSingle();
    if (!product) return jsonResponse({ error: 'Produto não encontrado' }, 404);
    if (!product.gtin) return jsonResponse({ error: 'Produto sem GTIN/EAN — Magalu exige código de barras válido' }, 400);
    if (!product.ncm) return jsonResponse({ error: 'Produto sem NCM — obrigatório no Magalu' }, 400);

    const token = await ensureToken(admin, conn, global);
    const baseUrl = String(global.api_base_url).replace(/\/$/, '');

    const payload = {
      sku: product.sku || product.id,
      title: product.name,
      description: product.description || product.name,
      brand: product.brand || 'Genérico',
      ncm: product.ncm,
      ean: product.gtin,
      price: Number(product.price || 0),
      stock: Number(product.stock_qty || 0),
      images: (product.images || []).map((u: string) => ({ url: u })),
    };

    const r = await fetch(`${baseUrl}/seller/v1/products`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[magalu-publish] error', r.status, JSON.stringify(result).slice(0, 600));
      return jsonResponse({ error: result, hint: 'Verifique se api_base_url e scope estão corretos no painel Magalu Developer' }, r.status);
    }
    return jsonResponse({ success: true, result });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
});
