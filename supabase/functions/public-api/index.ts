import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildOpenApiSpec } from './openapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'X-Total-Count, X-Typos-Environment, X-Typos-Dry-Run',
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });

const errorJson = (code: string, message: string, status = 400, details?: unknown) =>
  json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, status);

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface ApiContext {
  accountId: string;
  scopes: string[];
  keyId: string;
  environment: 'live' | 'test';
}

async function authenticate(req: Request): Promise<ApiContext | Response> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return errorJson('unauthorized', 'API key ausente. Use Authorization: Bearer <sua_chave>', 401);
  const key = auth.slice(7).trim();
  if (!key.startsWith('tps_')) return errorJson('unauthorized', 'Formato de chave inválido', 401);

  const hash = await sha256Hex(key);
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, account_id, scopes, revoked_at, expires_at, environment')
    .eq('key_hash', hash)
    .maybeSingle();
  if (error || !data) return errorJson('unauthorized', 'Chave inválida', 401);
  if (data.revoked_at) return errorJson('unauthorized', 'Chave revogada', 401);
  if (data.expires_at && new Date(data.expires_at) < new Date()) return errorJson('unauthorized', 'Chave expirada', 401);

  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {});

  return {
    accountId: data.account_id,
    scopes: data.scopes ?? [],
    keyId: data.id,
    environment: (data.environment as 'live' | 'test') || 'live',
  };
}

function requireScope(ctx: ApiContext, scope: string): Response | null {
  if (!ctx.scopes.includes(scope)) {
    return errorJson('forbidden', `Escopo "${scope}" necessário para este endpoint`, 403);
  }
  return null;
}

// ---------- PAGINATION (offset legado + cursor novo) ----------

function pageParams(url: URL): { page: number; limit: number; from: number; to: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}

function decodeCursor(cursor: string | null): { last_at: string; last_id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(atob(cursor));
    if (decoded?.last_at && decoded?.last_id) return decoded;
  } catch { /* ignore */ }
  return null;
}

function encodeCursor(last_at: string, last_id: string): string {
  return btoa(JSON.stringify({ last_at, last_id }));
}

function isCursorMode(url: URL): boolean {
  return url.searchParams.has('cursor') || url.searchParams.get('paginate') === 'cursor';
}

function paginated(data: any[], count: number | null, page: number, limit: number) {
  return json(
    { data, pagination: { page, limit, total: count ?? data.length, total_pages: count ? Math.ceil(count / limit) : 1 } },
    200,
    { 'X-Total-Count': String(count ?? data.length) },
  );
}

function cursorPaginated(data: any[], limit: number, getOrderFields: (row: any) => { at: string; id: string }) {
  const hasMore = data.length > limit;
  const sliced = hasMore ? data.slice(0, limit) : data;
  let next_cursor: string | null = null;
  if (hasMore && sliced.length > 0) {
    const last = sliced[sliced.length - 1];
    const f = getOrderFields(last);
    next_cursor = encodeCursor(f.at, f.id);
  }
  return json({ data: sliced, pagination: { limit, next_cursor, has_more: hasMore } });
}

async function readBody(req: Request): Promise<any | Response> {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return errorJson('invalid_body', 'JSON inválido', 400);
  }
}

// Whitelists — campos aceitos em escrita
const PRODUCT_WRITE_FIELDS = [
  'sku','name','description','description_long','category','subcategory','brand','unit',
  'gtin','price_default','cost_default','promo_price','promo_starts_at','promo_ends_at',
  'ncm','cest','cfop_default','origem_icms','cst_icms','csosn','cst_pis','cst_cofins','cst_ipi',
  'aliq_icms','aliq_pis','aliq_cofins','aliq_ipi','weight','weight_unit','image_url',
  'product_group','supplier_id','is_active',
];
const CUSTOMER_WRITE_FIELDS = [
  'name','document','email','phone','address_json','birth_date','credit_authorized','credit_limit',
];

function pick(obj: Record<string, any>, allowed: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of allowed) if (k in obj) out[k] = obj[k];
  return out;
}

// helper: dry-run synthetic response
function dryRun(payload: Record<string, any>, status = 201) {
  return json(
    { data: { ...payload, id: crypto.randomUUID(), _test_dry_run: true, created_at: new Date().toISOString() } },
    status,
    { 'X-Typos-Environment': 'test', 'X-Typos-Dry-Run': 'true' }
  );
}

// ---------- READ HANDLERS ----------

const PRODUCT_COLS = 'id, sku, gtin, name, description, category, subcategory, brand, unit, price_default, cost_default, promo_price, ncm, cest, cfop_default, image_url, is_active, created_at, updated_at';

async function handleProducts(ctx: ApiContext, url: URL): Promise<Response> {
  const block = requireScope(ctx, 'products:read'); if (block) return block;
  const q = url.searchParams.get('q');
  const category = url.searchParams.get('category');
  const updatedSince = url.searchParams.get('updated_since');

  // --- cursor mode ---
  if (isCursorMode(url)) {
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const cursor = decodeCursor(url.searchParams.get('cursor'));
    let query = supabase
      .from('products')
      .select(PRODUCT_COLS)
      .eq('account_id', ctx.accountId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,gtin.ilike.%${q}%`);
    if (category) query = query.eq('category', category);
    if (updatedSince) query = query.gte('updated_at', updatedSince);
    if (cursor) {
      // updated_at < cursor_at OR (updated_at = cursor_at AND id < cursor_id)
      query = query.or(`updated_at.lt.${cursor.last_at},and(updated_at.eq.${cursor.last_at},id.lt.${cursor.last_id})`);
    }
    const { data, error } = await query;
    if (error) return errorJson('query_error', error.message, 500);
    return cursorPaginated(data ?? [], limit, (r) => ({ at: r.updated_at, id: r.id }));
  }

  // --- offset mode (legado) ---
  const { page, limit, from, to } = pageParams(url);
  let query = supabase
    .from('products')
    .select(PRODUCT_COLS, { count: 'exact' })
    .eq('account_id', ctx.accountId)
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,gtin.ilike.%${q}%`);
  if (category) query = query.eq('category', category);
  if (updatedSince) query = query.gte('updated_at', updatedSince);

  const { data, count, error } = await query;
  if (error) return errorJson('query_error', error.message, 500);
  return paginated(data ?? [], count, page, limit);
}

async function handleProductById(ctx: ApiContext, id: string): Promise<Response> {
  const block = requireScope(ctx, 'products:read'); if (block) return block;
  const { data, error } = await supabase
    .from('products').select('*')
    .eq('account_id', ctx.accountId).eq('id', id).maybeSingle();
  if (error) return errorJson('query_error', error.message, 500);
  if (!data) return errorJson('not_found', 'Produto não encontrado', 404);
  return json({ data });
}

async function handleStock(ctx: ApiContext, url: URL): Promise<Response> {
  const block = requireScope(ctx, 'stock:read'); if (block) return block;
  const storeId = url.searchParams.get('store_id');
  const productId = url.searchParams.get('product_id');
  const updatedSince = url.searchParams.get('updated_since');

  const { data: stores } = await supabase.from('stores').select('id').eq('account_id', ctx.accountId);
  const storeIds = (stores ?? []).map(s => s.id);
  if (storeIds.length === 0) {
    return isCursorMode(url)
      ? cursorPaginated([], 50, () => ({ at: '', id: '' }))
      : paginated([], 0, 1, 50);
  }

  const COLS = 'id, store_id, product_id, variant_id, qty_on_hand, min_qty, expiration_date, updated_at';

  if (isCursorMode(url)) {
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const cursor = decodeCursor(url.searchParams.get('cursor'));
    let query = supabase
      .from('inventory').select(COLS).in('store_id', storeIds)
      .order('updated_at', { ascending: false }).order('id', { ascending: false })
      .limit(limit + 1);
    if (storeId) query = query.eq('store_id', storeId);
    if (productId) query = query.eq('product_id', productId);
    if (updatedSince) query = query.gte('updated_at', updatedSince);
    if (cursor) query = query.or(`updated_at.lt.${cursor.last_at},and(updated_at.eq.${cursor.last_at},id.lt.${cursor.last_id})`);
    const { data, error } = await query;
    if (error) return errorJson('query_error', error.message, 500);
    return cursorPaginated(data ?? [], limit, (r) => ({ at: r.updated_at, id: r.id }));
  }

  const { page, limit, from, to } = pageParams(url);
  let query = supabase
    .from('inventory').select(COLS, { count: 'exact' })
    .in('store_id', storeIds)
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (storeId) query = query.eq('store_id', storeId);
  if (productId) query = query.eq('product_id', productId);
  if (updatedSince) query = query.gte('updated_at', updatedSince);
  const { data, count, error } = await query;
  if (error) return errorJson('query_error', error.message, 500);
  return paginated(data ?? [], count, page, limit);
}

async function handleSales(ctx: ApiContext, url: URL): Promise<Response> {
  const block = requireScope(ctx, 'sales:read'); if (block) return block;
  const status = url.searchParams.get('status');
  const storeId = url.searchParams.get('store_id');
  const fromDate = url.searchParams.get('from');
  const toDate = url.searchParams.get('to');

  const COLS = 'id, order_number, store_id, customer_id, seller_user_id, status, subtotal, discount, total, source, notes, created_at, updated_at';

  if (isCursorMode(url)) {
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const cursor = decodeCursor(url.searchParams.get('cursor'));
    let query = supabase
      .from('sales').select(COLS).eq('account_id', ctx.accountId)
      .order('updated_at', { ascending: false }).order('id', { ascending: false })
      .limit(limit + 1);
    if (status) query = query.eq('status', status);
    if (storeId) query = query.eq('store_id', storeId);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);
    if (cursor) query = query.or(`updated_at.lt.${cursor.last_at},and(updated_at.eq.${cursor.last_at},id.lt.${cursor.last_id})`);
    const { data, error } = await query;
    if (error) return errorJson('query_error', error.message, 500);
    return cursorPaginated(data ?? [], limit, (r) => ({ at: r.updated_at, id: r.id }));
  }

  const { page, limit, from, to } = pageParams(url);
  let query = supabase
    .from('sales').select(COLS, { count: 'exact' })
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status) query = query.eq('status', status);
  if (storeId) query = query.eq('store_id', storeId);
  if (fromDate) query = query.gte('created_at', fromDate);
  if (toDate) query = query.lte('created_at', toDate);

  const { data, count, error } = await query;
  if (error) return errorJson('query_error', error.message, 500);
  return paginated(data ?? [], count, page, limit);
}

async function handleSaleById(ctx: ApiContext, id: string): Promise<Response> {
  const block = requireScope(ctx, 'sales:read'); if (block) return block;
  const { data: sale, error } = await supabase
    .from('sales').select('*').eq('account_id', ctx.accountId).eq('id', id).maybeSingle();
  if (error) return errorJson('query_error', error.message, 500);
  if (!sale) return errorJson('not_found', 'Venda não encontrada', 404);
  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase.from('sale_items').select('*').eq('sale_id', id),
    supabase.from('payments').select('*').eq('sale_id', id),
  ]);
  return json({ data: { ...sale, items: items ?? [], payments: payments ?? [] } });
}

async function handleCustomers(ctx: ApiContext, url: URL): Promise<Response> {
  const block = requireScope(ctx, 'customers:read'); if (block) return block;
  const q = url.searchParams.get('q');
  const updatedSince = url.searchParams.get('updated_since');
  const COLS = 'id, name, email, phone, document, address_json, birth_date, credit_authorized, credit_limit, created_at, updated_at';

  if (isCursorMode(url)) {
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const cursor = decodeCursor(url.searchParams.get('cursor'));
    let query = supabase
      .from('customers').select(COLS).eq('account_id', ctx.accountId)
      .order('updated_at', { ascending: false }).order('id', { ascending: false })
      .limit(limit + 1);
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,document.ilike.%${q}%`);
    if (updatedSince) query = query.gte('updated_at', updatedSince);
    if (cursor) query = query.or(`updated_at.lt.${cursor.last_at},and(updated_at.eq.${cursor.last_at},id.lt.${cursor.last_id})`);
    const { data, error } = await query;
    if (error) return errorJson('query_error', error.message, 500);
    return cursorPaginated(data ?? [], limit, (r) => ({ at: r.updated_at, id: r.id }));
  }

  const { page, limit, from, to } = pageParams(url);
  let query = supabase
    .from('customers').select(COLS, { count: 'exact' })
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,document.ilike.%${q}%`);
  if (updatedSince) query = query.gte('updated_at', updatedSince);

  const { data, count, error } = await query;
  if (error) return errorJson('query_error', error.message, 500);
  return paginated(data ?? [], count, page, limit);
}

async function handleStores(ctx: ApiContext): Promise<Response> {
  const block = requireScope(ctx, 'stores:read'); if (block) return block;
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, slug, is_active, address_json, created_at')
    .eq('account_id', ctx.accountId)
    .order('name');
  if (error) return errorJson('query_error', error.message, 500);
  return json({ data: data ?? [] });
}

async function handleRegisterWebhook(ctx: ApiContext, body: any): Promise<Response> {
  const block = requireScope(ctx, 'stock:read'); if (block) return block;
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  const secret = typeof body?.secret === 'string' ? body.secret.trim() : '';
  const allowedEvents = new Set(['stock.changed', 'product.updated', 'sale.paid', 'sale.canceled']);
  const events = Array.isArray(body?.events)
    ? body.events.filter((event: unknown) => typeof event === 'string' && allowedEvents.has(event))
    : ['stock.changed', 'product.updated', 'sale.paid'];

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid_protocol');
  } catch {
    return errorJson('validation_error', 'URL do webhook inválida', 422);
  }
  if (secret.length < 16) return errorJson('validation_error', 'Secret do webhook inválido', 422);
  if (events.length === 0) return errorJson('validation_error', 'Nenhum evento válido informado', 422);

  const { data: existing } = await supabase
    .from('webhook_endpoints')
    .select('id')
    .eq('account_id', ctx.accountId)
    .eq('url', url)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .update({ events, secret, is_active: true, failure_count: 0, description: 'WooCommerce Typos! ERP' })
      .eq('id', existing.id)
      .select('id, url, events, is_active')
      .single();
    if (error) return errorJson('update_error', error.message, 400);
    return json({ data });
  }

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({ account_id: ctx.accountId, url, events, secret, description: 'WooCommerce Typos! ERP' })
    .select('id, url, events, is_active')
    .single();
  if (error) return errorJson('insert_error', error.message, 400);
  return json({ data }, 201);
}

// ---------- WRITE HANDLERS ----------

async function handleCreateProduct(ctx: ApiContext, body: any): Promise<Response> {
  const block = requireScope(ctx, 'products:write'); if (block) return block;
  if (!body?.name || typeof body.name !== 'string') return errorJson('validation_error', 'Campo "name" é obrigatório', 422);
  const payload = pick(body, PRODUCT_WRITE_FIELDS);
  if (ctx.environment === 'test') return dryRun(payload);

  const { data, error } = await supabase.from('products').insert({ ...payload, account_id: ctx.accountId }).select('*').single();
  if (error) return errorJson('insert_error', error.message, 400);
  return json({ data }, 201);
}

async function handleUpdateProduct(ctx: ApiContext, id: string, body: any): Promise<Response> {
  const block = requireScope(ctx, 'products:write'); if (block) return block;
  const patch = pick(body || {}, PRODUCT_WRITE_FIELDS);
  if (Object.keys(patch).length === 0) return errorJson('validation_error', 'Nenhum campo válido para atualizar', 422);
  if (ctx.environment === 'test') return dryRun({ ...patch, id }, 200);

  const { data, error } = await supabase
    .from('products').update(patch)
    .eq('account_id', ctx.accountId).eq('id', id)
    .select('*').maybeSingle();
  if (error) return errorJson('update_error', error.message, 400);
  if (!data) return errorJson('not_found', 'Produto não encontrado', 404);
  return json({ data });
}

async function handleDeleteProduct(ctx: ApiContext, id: string): Promise<Response> {
  const block = requireScope(ctx, 'products:write'); if (block) return block;
  if (ctx.environment === 'test') {
    return json({ data: { id, deleted: true, _test_dry_run: true } }, 200, { 'X-Typos-Environment': 'test', 'X-Typos-Dry-Run': 'true' });
  }
  const { data, error } = await supabase
    .from('products').update({ is_active: false })
    .eq('account_id', ctx.accountId).eq('id', id)
    .select('id').maybeSingle();
  if (error) return errorJson('delete_error', error.message, 400);
  if (!data) return errorJson('not_found', 'Produto não encontrado', 404);
  return json({ data: { id: data.id, deleted: true } });
}

async function handleCreateCustomer(ctx: ApiContext, body: any): Promise<Response> {
  const block = requireScope(ctx, 'customers:write'); if (block) return block;
  if (!body?.name || typeof body.name !== 'string') return errorJson('validation_error', 'Campo "name" é obrigatório', 422);
  const payload = pick(body, CUSTOMER_WRITE_FIELDS);
  if (ctx.environment === 'test') return dryRun(payload);

  const { data, error } = await supabase.from('customers').insert({ ...payload, account_id: ctx.accountId }).select('*').single();
  if (error) return errorJson('insert_error', error.message, 400);
  return json({ data }, 201);
}

async function handleUpdateCustomer(ctx: ApiContext, id: string, body: any): Promise<Response> {
  const block = requireScope(ctx, 'customers:write'); if (block) return block;
  const patch = pick(body || {}, CUSTOMER_WRITE_FIELDS);
  if (Object.keys(patch).length === 0) return errorJson('validation_error', 'Nenhum campo válido para atualizar', 422);
  if (ctx.environment === 'test') return dryRun({ ...patch, id }, 200);

  const { data, error } = await supabase
    .from('customers').update(patch)
    .eq('account_id', ctx.accountId).eq('id', id)
    .select('*').maybeSingle();
  if (error) return errorJson('update_error', error.message, 400);
  if (!data) return errorJson('not_found', 'Cliente não encontrado', 404);
  return json({ data });
}

// ---------- CREATE SALE (e-commerce / WooCommerce ingest) ----------

const PAYMENT_METHODS = ['pix', 'cash', 'card', 'crediario', 'financeira', 'store_credit'];
const SALE_STATUSES = ['draft', 'open', 'paid', 'canceled', 'crediario'];

function normalizeSaleStatus(input: unknown): 'draft' | 'open' | 'paid' | 'canceled' | 'crediario' {
  const s = String(input || '').toLowerCase().trim();
  if (SALE_STATUSES.includes(s)) return s as any;
  if (['processing', 'completed', 'paid'].includes(s)) return 'paid';
  if (['cancelled', 'canceled', 'refunded', 'failed'].includes(s)) return 'canceled';
  if (['pending', 'on-hold', 'on_hold', 'checkout-draft', 'open', 'awaiting_payment'].includes(s)) return 'open';
  return 'paid';
}

function paymentRowsForSale(saleId: string, payments: any[]): any[] {
  return payments
    .filter((p: any) => p && PAYMENT_METHODS.includes(p.method))
    .map((p: any) => ({
      sale_id: saleId,
      method: p.method,
      card_type: p.method === 'card' ? (p.card_type || p.cardType || null) : null,
      brand: p.method === 'card' ? (p.brand || p.card_brand || null) : null,
      paid_value: Number(p.paid_value ?? p.amount ?? 0),
      installments: p.installments ? Number(p.installments) : 1,
      card_fee_percent: p.method === 'card' ? Number(p.card_fee_percent || 0) : 0,
      card_fee_value: p.method === 'card'
        ? Number(p.card_fee_value || ((Number(p.paid_value ?? p.amount ?? 0) * Number(p.card_fee_percent || 0)) / 100).toFixed(2))
        : 0,
      notes: p.notes || null,
    }));
}

async function replaceSalePayments(saleId: string, payments: any[]) {
  await supabase.from('payments').delete().eq('sale_id', saleId);
  const rows = paymentRowsForSale(saleId, payments);
  if (rows.length > 0) await supabase.from('payments').insert(rows);
}

async function restoreInventoryForSale(sale: any) {
  const { data: items } = await supabase.from('sale_items').select('product_id, qty').eq('sale_id', sale.id);
  for (const item of items || []) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('id, qty_on_hand')
      .eq('store_id', sale.store_id)
      .eq('product_id', item.product_id)
      .maybeSingle();
    if (inv) {
      await supabase.from('inventory').update({
        qty_on_hand: Number(inv.qty_on_hand || 0) + Number(item.qty || 0),
        updated_at: new Date().toISOString(),
      }).eq('id', inv.id);
    } else {
      await supabase.from('inventory').insert({
        store_id: sale.store_id,
        product_id: item.product_id,
        qty_on_hand: Number(item.qty || 0),
      });
    }
  }
}

async function resolveProduct(accountId: string, ref: any): Promise<{ id: string; price_default: number; cost_default: number } | null> {
  if (ref?.product_id) {
    const { data } = await supabase.from('products').select('id, price_default, cost_default')
      .eq('account_id', accountId).eq('id', ref.product_id).maybeSingle();
    if (data) return data as any;
  }
  if (ref?.sku) {
    const { data } = await supabase.from('products').select('id, price_default, cost_default')
      .eq('account_id', accountId).eq('sku', ref.sku).maybeSingle();
    if (data) return data as any;
  }
  if (ref?.gtin) {
    const { data } = await supabase.from('products').select('id, price_default, cost_default')
      .eq('account_id', accountId).eq('gtin', ref.gtin).maybeSingle();
    if (data) return data as any;
  }
  return null;
}

async function handleCreateSale(ctx: ApiContext, body: any): Promise<Response> {
  const block = requireScope(ctx, 'sales:write'); if (block) return block;

  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return errorJson('validation_error', '"items" é obrigatório (array não-vazio)', 422);

  // ---- Resolve store ----
  let storeId: string | null = body?.store_id || null;
  if (!storeId) {
    const { data: stores } = await supabase
      .from('stores').select('id').eq('account_id', ctx.accountId)
      .eq('is_active', true).order('created_at').limit(1);
    storeId = stores?.[0]?.id ?? null;
  } else {
    const { data: s } = await supabase.from('stores').select('id, account_id').eq('id', storeId).maybeSingle();
    if (!s || s.account_id !== ctx.accountId) return errorJson('forbidden', 'Loja não pertence à conta', 403);
  }
  if (!storeId) return errorJson('validation_error', 'Nenhuma loja ativa encontrada para esta conta', 422);

  // ---- Seller (account owner) ----
  const { data: acc } = await supabase.from('accounts').select('owner_user_id').eq('id', ctx.accountId).maybeSingle();
  const sellerUserId = acc?.owner_user_id;
  if (!sellerUserId) return errorJson('config_error', 'Conta sem owner_user_id', 500);

  // ---- Dedupe by external_id (tag in notes) ----
  const externalId: string | null = body?.external_id ? String(body.external_id) : null;
  const externalTag = externalId ? `[EXT:${externalId}]` : null;
  if (externalTag) {
    const { data: existing } = await supabase
      .from('sales').select('id, order_number, status, store_id')
      .eq('account_id', ctx.accountId)
      .ilike('notes', `%${externalTag}%`)
      .maybeSingle();
    if (existing) {
      const desiredStatus = normalizeSaleStatus(body?.status);
      const updatePayload: any = { updated_at: new Date().toISOString(), source: body?.source || 'woocommerce' };
      const payments = Array.isArray(body?.payments) ? body.payments : [];

      if (desiredStatus === 'canceled') {
        return await handleCancelSale(ctx, { sale_id: existing.id, reason: body?.cancel_reason || 'Cancelado via WooCommerce' });
      }
      if (existing.status === 'paid' && desiredStatus !== 'paid' && desiredStatus !== 'crediario') {
        await restoreInventoryForSale(existing);
        await supabase.from('commissions').update({ status: 'canceled' }).eq('sale_id', existing.id);
        await supabase.from('accounts_receivable').update({ status: 'canceled' }).eq('sale_id', existing.id);
      }
      if (SALE_STATUSES.includes(desiredStatus)) updatePayload.status = desiredStatus;
      if (desiredStatus !== 'canceled') {
        updatePayload.canceled_by = null;
        updatePayload.canceled_at = null;
        updatePayload.cancel_reason = null;
      }
      if (body?.total !== undefined) updatePayload.total = Number(body.total);
      if (body?.subtotal !== undefined) updatePayload.subtotal = Number(body.subtotal);
      if (body?.discount !== undefined) updatePayload.discount = Number(body.discount || 0);
      if (body?.delivery_fee !== undefined) updatePayload.delivery_fee = Number(body.delivery_fee || 0);
      if ((desiredStatus === 'paid' || desiredStatus === 'crediario') && existing.status !== 'paid' && existing.status !== 'crediario') {
        await replaceSalePayments(existing.id, payments);
      }
      const { error: updErr } = await supabase.from('sales').update(updatePayload).eq('id', existing.id);
      if (updErr) return errorJson('update_error', updErr.message, 400);
      if (!(desiredStatus === 'paid' || desiredStatus === 'crediario') || existing.status === 'paid' || existing.status === 'crediario') {
        await replaceSalePayments(existing.id, desiredStatus === 'paid' || desiredStatus === 'crediario' ? payments : []);
      }
      return json({ data: { id: existing.id, order_number: existing.order_number, status: desiredStatus, deduped: true, updated: true } }, 200);
    }
  }

  if (ctx.environment === 'test') {
    return dryRun({
      store_id: storeId,
      external_id: externalId,
      items_count: items.length,
      total: body?.total ?? null,
    }, 201);
  }

  // ---- Resolve customer ----
  let customerId: string | null = null;
  const c = body?.customer;
  if (c && (c.name || c.phone || c.email || c.document)) {
    let existingCustomer: any = null;
    if (c.phone) {
      const r = await supabase.from('customers').select('id')
        .eq('account_id', ctx.accountId).eq('phone', c.phone).maybeSingle();
      existingCustomer = r.data;
    }
    if (!existingCustomer && c.email) {
      const r = await supabase.from('customers').select('id')
        .eq('account_id', ctx.accountId).eq('email', c.email).maybeSingle();
      existingCustomer = r.data;
    }
    if (!existingCustomer && c.document) {
      const r = await supabase.from('customers').select('id')
        .eq('account_id', ctx.accountId).eq('document', c.document).maybeSingle();
      existingCustomer = r.data;
    }
    if (existingCustomer) {
      customerId = existingCustomer.id;
      const updates: any = {};
      if (c.name) updates.name = c.name;
      if (c.address_json) updates.address_json = c.address_json;
      if (Object.keys(updates).length > 0) {
        await supabase.from('customers').update(updates).eq('id', customerId);
      }
    } else if (c.name) {
      const { data: nc } = await supabase.from('customers').insert({
        account_id: ctx.accountId,
        name: c.name,
        phone: c.phone || null,
        email: c.email || null,
        document: c.document || null,
        address_json: c.address_json || null,
      }).select('id').single();
      customerId = nc?.id ?? null;
    }
  }

  // ---- Resolve & validate items ----
  const resolvedItems: any[] = [];
  const unknown: any[] = [];
  let computedSubtotal = 0;
  for (const it of items) {
    const prod = await resolveProduct(ctx.accountId, it);
    if (!prod) { unknown.push({ sku: it.sku, gtin: it.gtin, product_id: it.product_id }); continue; }
    const qty = Number(it.qty) || 0;
    if (qty <= 0) return errorJson('validation_error', `Quantidade inválida para item (sku=${it.sku ?? ''})`, 422);
    const unitPrice = it.unit_price !== undefined ? Number(it.unit_price) : Number(prod.price_default);
    const unitCost = it.unit_cost !== undefined ? Number(it.unit_cost) : Number(prod.cost_default || 0);
    const totalLine = +(unitPrice * qty).toFixed(2);
    computedSubtotal += totalLine;
    resolvedItems.push({ product_id: prod.id, qty, unit_price: unitPrice, unit_cost: unitCost, total_line: totalLine });
  }
  if (unknown.length > 0) {
    return errorJson('product_not_found', 'Alguns produtos não foram encontrados no ERP', 422, { unknown });
  }

  const subtotal = body?.subtotal !== undefined ? Number(body.subtotal) : +computedSubtotal.toFixed(2);
  const discount = Number(body?.discount || 0);
  const deliveryFee = Number(body?.delivery_fee || 0);
  const total = body?.total !== undefined ? Number(body.total) : +(subtotal - discount + deliveryFee).toFixed(2);

  const userNotes = body?.notes ? String(body.notes) : '';
  const finalNotes = [externalTag, userNotes].filter(Boolean).join(' ').trim() || null;

  // ---- Create sale as 'open' first ----
  const { data: sale, error: saleErr } = await supabase.from('sales').insert({
    account_id: ctx.accountId,
    store_id: storeId,
    seller_user_id: sellerUserId,
    customer_id: customerId,
    status: 'open',
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    total,
    source: body?.source || 'ecommerce',
    notes: finalNotes,
  }).select('id, order_number').single();
  if (saleErr || !sale) return errorJson('insert_error', saleErr?.message || 'Falha ao criar venda', 400);

  // ---- Items ----
  const itemsPayload = resolvedItems.map(it => ({ ...it, sale_id: sale.id }));
  const { error: itemsErr } = await supabase.from('sale_items').insert(itemsPayload);
  if (itemsErr) {
    await supabase.from('sales').delete().eq('id', sale.id);
    return errorJson('insert_error', `Falha ao inserir itens: ${itemsErr.message}`, 400);
  }

  const desiredStatus = normalizeSaleStatus(body?.status);

  // ---- Payments ----
  const payments = Array.isArray(body?.payments) ? body.payments : [];
  if ((desiredStatus === 'paid' || desiredStatus === 'crediario') && payments.length > 0) {
    const paymentsPayload = paymentRowsForSale(sale.id, payments);
    if (paymentsPayload.length > 0) {
      await supabase.from('payments').insert(paymentsPayload);
    }
  }

  // ---- Update status to trigger stock deduction + commission ----
  if (desiredStatus === 'canceled') {
    return await handleCancelSale(ctx, { sale_id: sale.id, reason: body?.cancel_reason || 'Cancelado via WooCommerce' });
  }
  if (desiredStatus === 'paid' || desiredStatus === 'crediario') {
    const { error: updErr } = await supabase.from('sales').update({ status: desiredStatus }).eq('id', sale.id);
    if (updErr) {
      return errorJson('update_error', `Venda criada mas falhou ao marcar como ${desiredStatus}: ${updErr.message}`, 500, { sale_id: sale.id });
    }
  }

  return json({
    data: {
      id: sale.id,
      order_number: sale.order_number,
      status: desiredStatus,
      total,
      external_id: externalId,
    }
  }, 201);
}

async function handleCancelSale(ctx: ApiContext, body: any): Promise<Response> {
  const block = requireScope(ctx, 'sales:write'); if (block) return block;

  const reason: string = body?.reason ? String(body.reason) : 'Cancelado via API';
  let saleId: string | null = body?.sale_id ? String(body.sale_id) : null;

  if (!saleId && body?.external_id) {
    const externalTag = `[EXT:${String(body.external_id)}]`;
    const { data: existing } = await supabase
      .from('sales').select('id, status')
      .eq('account_id', ctx.accountId)
      .ilike('notes', `%${externalTag}%`)
      .maybeSingle();
    if (!existing) return errorJson('not_found', `Venda com external_id=${body.external_id} não encontrada`, 404);
    saleId = existing.id;
    if (existing.status === 'canceled') {
      return json({ data: { id: saleId, status: 'canceled', already_canceled: true } }, 200);
    }
  }

  if (!saleId) return errorJson('validation_error', 'Forneça "sale_id" ou "external_id"', 422);

  const { data: sale } = await supabase
    .from('sales').select('id, account_id, status').eq('id', saleId).maybeSingle();
  if (!sale || sale.account_id !== ctx.accountId) return errorJson('not_found', 'Venda não encontrada', 404);
  if (sale.status === 'canceled') {
    return json({ data: { id: saleId, status: 'canceled', already_canceled: true } }, 200);
  }

  if (ctx.environment === 'test') {
    return dryRun({ sale_id: saleId, action: 'cancel', reason }, 200);
  }

  const { data: acc } = await supabase.from('accounts').select('owner_user_id').eq('id', ctx.accountId).maybeSingle();
  const userId = acc?.owner_user_id;
  if (!userId) return errorJson('config_error', 'Conta sem owner_user_id', 500);

  const { error: rpcErr } = await supabase.rpc('cancel_sale', {
    _sale_id: saleId, _user_id: userId, _reason: reason,
  });
  if (rpcErr) return errorJson('cancel_error', rpcErr.message, 400);

  return json({ data: { id: saleId, status: 'canceled', reason } }, 200);
}

async function handleUpdateSaleStatus(ctx: ApiContext, body: any): Promise<Response> {
  const block = requireScope(ctx, 'sales:write'); if (block) return block;
  let saleId: string | null = body?.sale_id ? String(body.sale_id) : null;
  const desiredStatus = normalizeSaleStatus(body?.status);

  if (!saleId && body?.external_id) {
    const externalTag = `[EXT:${String(body.external_id)}]`;
    const { data: existing } = await supabase
      .from('sales').select('id')
      .eq('account_id', ctx.accountId)
      .ilike('notes', `%${externalTag}%`)
      .maybeSingle();
    saleId = existing?.id ?? null;
  }
  if (!saleId) return errorJson('validation_error', 'Forneça "sale_id" ou "external_id"', 422);

  const { data: sale } = await supabase
    .from('sales').select('id, account_id, store_id, status').eq('id', saleId).maybeSingle();
  if (!sale || sale.account_id !== ctx.accountId) return errorJson('not_found', 'Venda não encontrada', 404);
  if (sale.status === desiredStatus) {
    if (Array.isArray(body?.payments)) await replaceSalePayments(saleId, desiredStatus === 'paid' || desiredStatus === 'crediario' ? body.payments : []);
    return json({ data: { id: saleId, status: desiredStatus, unchanged: true } }, 200);
  }
  if (desiredStatus === 'canceled') return await handleCancelSale(ctx, { sale_id: saleId, reason: body?.reason || 'Cancelado via WooCommerce' });

  if (ctx.environment === 'test') {
    return dryRun({ sale_id: saleId, old_status: sale.status, new_status: desiredStatus }, 200);
  }

  if ((sale.status === 'paid' || sale.status === 'crediario') && desiredStatus !== 'paid' && desiredStatus !== 'crediario') {
    await restoreInventoryForSale(sale);
    await supabase.from('commissions').update({ status: 'canceled' }).eq('sale_id', saleId);
    await supabase.from('accounts_receivable').update({ status: 'canceled' }).eq('sale_id', saleId);
  }

  if (Array.isArray(body?.payments)) await replaceSalePayments(saleId, desiredStatus === 'paid' || desiredStatus === 'crediario' ? body.payments : []);
  const { error: updErr } = await supabase.from('sales').update({
    status: desiredStatus,
    canceled_by: null,
    canceled_at: null,
    cancel_reason: null,
    updated_at: new Date().toISOString(),
  }).eq('id', saleId);
  if (updErr) return errorJson('update_error', updErr.message, 400);

  return json({ data: { id: saleId, status: desiredStatus, previous_status: sale.status } }, 200);
}

async function handleStockAdjust(ctx: ApiContext, body: any): Promise<Response> {
  const block = requireScope(ctx, 'stock:write'); if (block) return block;
  const storeId = body?.store_id;
  const productId = body?.product_id;
  const qtyOnHand = body?.qty_on_hand;
  const qtyDelta = body?.qty_delta;
  const minQty = body?.min_qty;

  if (!storeId || !productId) return errorJson('validation_error', '"store_id" e "product_id" são obrigatórios', 422);
  if (qtyOnHand === undefined && qtyDelta === undefined && minQty === undefined) {
    return errorJson('validation_error', 'Forneça "qty_on_hand", "qty_delta" ou "min_qty"', 422);
  }

  if (ctx.environment === 'test') {
    return dryRun({ store_id: storeId, product_id: productId, qty_on_hand: qtyOnHand ?? null, qty_delta: qtyDelta ?? null, min_qty: minQty ?? null }, 200);
  }

  const { data: store } = await supabase.from('stores').select('id, account_id').eq('id', storeId).maybeSingle();
  if (!store || store.account_id !== ctx.accountId) return errorJson('forbidden', 'Loja não pertence à conta', 403);

  const { data: prod } = await supabase.from('products').select('id, account_id').eq('id', productId).maybeSingle();
  if (!prod || prod.account_id !== ctx.accountId) return errorJson('forbidden', 'Produto não pertence à conta', 403);

  const { data: current } = await supabase
    .from('inventory').select('id, qty_on_hand, min_qty')
    .eq('store_id', storeId).eq('product_id', productId).is('variant_id', null).maybeSingle();

  let newQty: number;
  if (qtyOnHand !== undefined) newQty = Number(qtyOnHand);
  else if (qtyDelta !== undefined) newQty = Number(current?.qty_on_hand ?? 0) + Number(qtyDelta);
  else newQty = Number(current?.qty_on_hand ?? 0);

  if (!Number.isFinite(newQty)) return errorJson('validation_error', 'Quantidade inválida', 422);
  if (newQty < 0) return errorJson('validation_error', 'Saldo final não pode ser negativo', 422);

  const newMin = minQty !== undefined ? Number(minQty) : (current?.min_qty ?? 0);

  if (current) {
    const { data, error } = await supabase
      .from('inventory')
      .update({ qty_on_hand: newQty, min_qty: newMin, updated_at: new Date().toISOString() })
      .eq('id', current.id)
      .select('*').single();
    if (error) return errorJson('update_error', error.message, 400);
    return json({ data });
  } else {
    const { data, error } = await supabase
      .from('inventory')
      .insert({ store_id: storeId, product_id: productId, qty_on_hand: newQty, min_qty: newMin })
      .select('*').single();
    if (error) return errorJson('insert_error', error.message, 400);
    return json({ data }, 201);
  }
}

// ---------- LOGGING ----------

function logRequest(opts: {
  ctx: ApiContext | null;
  method: string;
  path: string;
  url: URL;
  status: number;
  latency: number;
  ip: string;
  userAgent: string;
  errorCode?: string;
}) {
  if (!opts.ctx) return; // só loga requisições autenticadas
  const queryParams: Record<string, string> = {};
  opts.url.searchParams.forEach((v, k) => { queryParams[k] = v; });
  supabase.from('api_request_logs').insert({
    account_id: opts.ctx.accountId,
    api_key_id: opts.ctx.keyId,
    environment: opts.ctx.environment,
    method: opts.method,
    path: opts.path,
    query_params: Object.keys(queryParams).length ? queryParams : null,
    status_code: opts.status,
    latency_ms: Math.round(opts.latency),
    ip: opts.ip || null,
    user_agent: opts.userAgent || null,
    error_code: opts.errorCode || null,
  }).then(() => {}, () => {});
}

// ---------- ROUTER ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const start = performance.now();
  const url = new URL(req.url);
  let path = url.pathname
    .replace(/^\/functions\/v1\/public-api/, '')
    .replace(/^\/public-api/, '');
  if (!path.startsWith('/')) path = '/' + path;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  const userAgent = req.headers.get('user-agent') || '';

  if (path === '/' || path === '') {
    return json({
      name: 'Typos! ERP — Public API',
      version: 'v1',
      docs: 'https://typoserp.com.br/docs/api',
      openapi: `${url.origin}/functions/v1/public-api/openapi.json`,
    });
  }

  // OpenAPI / Swagger spec — fonte única de verdade, sem auth
  if (path === '/openapi.json' || path === '/openapi') {
    const spec = buildOpenApiSpec(`${url.origin}/functions/v1/public-api`);
    return new Response(JSON.stringify(spec, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  const finalize = (res: Response): Response => {
    const latency = performance.now() - start;
    let errorCode: string | undefined;
    if (res.status >= 400) {
      // tenta extrair error.code do clone para log (sem bloquear)
      res.clone().json().then((b: any) => {
        logRequest({
          ctx: auth, method: req.method, path, url,
          status: res.status, latency, ip, userAgent,
          errorCode: b?.error?.code,
        });
      }).catch(() => {
        logRequest({ ctx: auth, method: req.method, path, url, status: res.status, latency, ip, userAgent });
      });
    } else {
      logRequest({ ctx: auth, method: req.method, path, url, status: res.status, latency, ip, userAgent });
    }
    // adiciona header de ambiente em todas respostas autenticadas
    const headers = new Headers(res.headers);
    headers.set('X-Typos-Environment', auth.environment);
    return new Response(res.body, { status: res.status, headers });
  };

  try {
    const method = req.method;
    let response: Response;

    // --- Products ---
    if (path === '/v1/products') {
      if (method === 'GET') response = await handleProducts(auth, url);
      else if (method === 'POST') {
        const body = await readBody(req); if (body instanceof Response) return finalize(body);
        response = await handleCreateProduct(auth, body);
      } else response = errorJson('method_not_allowed', `Método ${method} não permitido em ${path}`, 405);
      return finalize(response);
    }
    let m = path.match(/^\/v1\/products\/([^/]+)$/);
    if (m) {
      if (method === 'GET') response = await handleProductById(auth, m[1]);
      else if (method === 'PATCH' || method === 'PUT') {
        const body = await readBody(req); if (body instanceof Response) return finalize(body);
        response = await handleUpdateProduct(auth, m[1], body);
      } else if (method === 'DELETE') response = await handleDeleteProduct(auth, m[1]);
      else response = errorJson('method_not_allowed', `Método ${method} não permitido`, 405);
      return finalize(response);
    }

    // --- Stock ---
    if (path === '/v1/stock' && method === 'GET') return finalize(await handleStock(auth, url));
    if (path === '/v1/stock/adjust' && method === 'POST') {
      const body = await readBody(req); if (body instanceof Response) return finalize(body);
      return finalize(await handleStockAdjust(auth, body));
    }
    if (path === '/v1/webhooks/register' && method === 'POST') {
      const body = await readBody(req); if (body instanceof Response) return finalize(body);
      return finalize(await handleRegisterWebhook(auth, body));
    }

    // --- Sales ---
    if (path === '/v1/sales') {
      if (method === 'GET') return finalize(await handleSales(auth, url));
      if (method === 'POST') {
        const body = await readBody(req); if (body instanceof Response) return finalize(body);
        return finalize(await handleCreateSale(auth, body));
      }
      return finalize(errorJson('method_not_allowed', `Método ${method} não permitido em ${path}`, 405));
    }
    if (path === '/v1/sales/cancel' && method === 'POST') {
      const body = await readBody(req); if (body instanceof Response) return finalize(body);
      return finalize(await handleCancelSale(auth, body));
    }
    if (path === '/v1/sales/status' && method === 'POST') {
      const body = await readBody(req); if (body instanceof Response) return finalize(body);
      return finalize(await handleUpdateSaleStatus(auth, body));
    }
    m = path.match(/^\/v1\/sales\/([^/]+)\/cancel$/);
    if (m && method === 'POST') {
      const body = await readBody(req); if (body instanceof Response) return finalize(body);
      return finalize(await handleCancelSale(auth, { ...body, sale_id: m[1] }));
    }
    m = path.match(/^\/v1\/sales\/([^/]+)\/status$/);
    if (m && method === 'POST') {
      const body = await readBody(req); if (body instanceof Response) return finalize(body);
      return finalize(await handleUpdateSaleStatus(auth, { ...body, sale_id: m[1] }));
    }
    m = path.match(/^\/v1\/sales\/([^/]+)$/);
    if (m && method === 'GET') return finalize(await handleSaleById(auth, m[1]));

    // --- Customers ---
    if (path === '/v1/customers') {
      if (method === 'GET') response = await handleCustomers(auth, url);
      else if (method === 'POST') {
        const body = await readBody(req); if (body instanceof Response) return finalize(body);
        response = await handleCreateCustomer(auth, body);
      } else response = errorJson('method_not_allowed', `Método ${method} não permitido`, 405);
      return finalize(response);
    }
    m = path.match(/^\/v1\/customers\/([^/]+)$/);
    if (m && (method === 'PATCH' || method === 'PUT')) {
      const body = await readBody(req); if (body instanceof Response) return finalize(body);
      return finalize(await handleUpdateCustomer(auth, m[1], body));
    }

    // --- Stores ---
    if (path === '/v1/stores' && method === 'GET') return finalize(await handleStores(auth));

    return finalize(errorJson('not_found', `Rota ${method} ${path} não encontrada`, 404));
  } catch (err: any) {
    console.error('public-api error', err);
    return finalize(errorJson('internal_error', err.message ?? 'erro', 500));
  }
});
