import { supabase } from '@/integrations/supabase/client';

export type ExpirationAlertType = 'ok' | 'promo' | 'saldao' | 'descartar';

export interface ExpirationAlertRow {
  id: string;
  source: 'batch' | 'inventory';
  product_id: string;
  store_id: string;
  product_name: string;
  batch_label: string | null;
  expiration_date: string;
  quantity: number;
  days_left: number;
  store_name: string;
  alert_type: ExpirationAlertType;
}

interface FetchExpirationAlertRowsOptions {
  accountId: string;
  storeIds: string[];
  withinDays?: number;
  limit?: number;
}

interface NamedRelation {
  name: string | null;
}

interface ProductExpirationDateRecord {
  id: string;
  product_id: string;
  store_id: string;
  batch_label: string | null;
  expiration_date: string;
  quantity: number | null;
  products?: NamedRelation | null;
  stores?: NamedRelation | null;
}

interface InventoryExpirationRecord {
  id: string;
  product_id: string;
  store_id: string;
  expiration_date: string | null;
  qty_on_hand: number | null;
  products?: NamedRelation | null;
  stores?: NamedRelation | null;
}

const QUERY_PAGE_SIZE = 1000;

const toExpirationDate = (value: string) => new Date(`${value}T12:00:00`);

const buildCutoffDate = (withinDays?: number) => {
  if (typeof withinDays !== 'number') return null;
  const date = new Date();
  date.setDate(date.getDate() + withinDays);
  return date.toISOString().split('T')[0];
};

const calculateDaysLeft = (expirationDate: string) => {
  const diffMs = toExpirationDate(expirationDate).getTime() - new Date().getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const getExpirationAlertType = (daysLeft: number): ExpirationAlertType => {
  if (daysLeft <= 0) return 'descartar';
  if (daysLeft <= 30) return 'saldao';
  if (daysLeft <= 90) return 'promo';
  return 'ok';
};

export const formatExpirationDate = (value: string) => toExpirationDate(value).toLocaleDateString('pt-BR');

async function fetchAllPages<T>(
  queryFactory: (from: number, to: number) => Promise<{ data: T[] | null; error: Error | null }>,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const to = from + QUERY_PAGE_SIZE - 1;
    const { data, error } = await queryFactory(from, to);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);

    if (data.length < QUERY_PAGE_SIZE) break;
  }

  return rows;
}

function mapExpirationRow(
  row: ProductExpirationDateRecord | InventoryExpirationRecord,
  source: 'batch' | 'inventory',
  quantity: number,
): ExpirationAlertRow {
  const expirationDate = row.expiration_date as string;
  const daysLeft = calculateDaysLeft(expirationDate);

  return {
    id: `${source}-${row.id}`,
    source,
    product_id: row.product_id,
    store_id: row.store_id,
    product_name: row.products?.name || '—',
    batch_label: source === 'batch' ? (row as ProductExpirationDateRecord).batch_label : null,
    expiration_date: expirationDate,
    quantity,
    days_left: daysLeft,
    store_name: row.stores?.name || '—',
    alert_type: getExpirationAlertType(daysLeft),
  };
}

export async function fetchExpirationAlertRows({
  accountId,
  storeIds,
  withinDays,
  limit,
}: FetchExpirationAlertRowsOptions) {
  const normalizedStoreIds = Array.from(new Set(storeIds.filter(Boolean)));

  if (!accountId || normalizedStoreIds.length === 0) {
    return [] as ExpirationAlertRow[];
  }

  const cutoffDate = buildCutoffDate(withinDays);

  const [batchRows, inventoryRows] = await Promise.all([
    fetchAllPages<ProductExpirationDateRecord>(async (from, to) => {
      let query = supabase
        .from('product_expiration_dates')
        .select('id, product_id, store_id, batch_label, expiration_date, quantity, products(name), stores(name)')
        .eq('account_id', accountId)
        .in('store_id', normalizedStoreIds)
        .order('expiration_date', { ascending: true })
        .range(from, to);

      if (cutoffDate) {
        query = query.lte('expiration_date', cutoffDate);
      }

      return query;
    }),
    fetchAllPages<InventoryExpirationRecord>(async (from, to) => {
      let query = supabase
        .from('inventory')
        .select('id, product_id, store_id, expiration_date, qty_on_hand, products(name), stores(name)')
        .in('store_id', normalizedStoreIds)
        .not('expiration_date', 'is', null)
        .order('expiration_date', { ascending: true })
        .range(from, to);

      if (cutoffDate) {
        query = query.lte('expiration_date', cutoffDate);
      }

      return query;
    }),
  ]);

  const batchKeys = new Set(
    batchRows.map((row) => `${row.product_id}:${row.store_id}:${row.expiration_date}`),
  );

  const mergedRows = [
    ...batchRows.map((row) => mapExpirationRow(row, 'batch', Number(row.quantity || 0))),
    ...inventoryRows
      .filter((row) => row.expiration_date)
      .filter((row) => !batchKeys.has(`${row.product_id}:${row.store_id}:${row.expiration_date}`))
      .map((row) => mapExpirationRow(row, 'inventory', Number(row.qty_on_hand || 0))),
  ].sort((a, b) => {
    if (a.expiration_date !== b.expiration_date) {
      return a.expiration_date.localeCompare(b.expiration_date);
    }

    return a.product_name.localeCompare(b.product_name, 'pt-BR');
  });

  return typeof limit === 'number' ? mergedRows.slice(0, limit) : mergedRows;
}