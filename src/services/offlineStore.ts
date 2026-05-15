/**
 * Offline PDV Store - IndexedDB-backed storage for offline sales and product cache.
 * Minimal, focused, no external dependencies.
 */

const DB_NAME = 'typos_pdv_offline';
const DB_VERSION = 1;

export type OfflineSaleStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface OfflineSale {
  id: string; // local UUID
  account_id: string;
  store_id: string;
  seller_id: string;
  seller_email: string;
  customer_id: string | null;
  customer_name: string | null;
  discount: number;
  delivery_fee: number;
  assembly_fee?: number;
  subtotal: number;
  total: number;
  notes: string | null;
  items: OfflineSaleItem[];
  payments: OfflinePayment[];
  created_at: string; // ISO string
  status: OfflineSaleStatus;
  sync_error?: string;
  synced_sale_id?: string; // remote sale ID after sync
  sync_attempts: number;
}

export interface OfflineSaleItem {
  product_id: string;
  product_name: string;
  sku: string | null;
  qty: number;
  unit_price: number;
  unit_cost: number;
  total_line: number;
  variant_id?: string | null;
  presentation_id?: string | null;
  presentation_name?: string | null;
  conversion_factor?: number | null;
  sold_qty?: number | null;
  base_qty?: number | null;
}

export interface OfflinePayment {
  method: string;
  amount: number;
  card_type?: string | null;
  card_brand?: string | null;
  installments: number;
  card_fee_percent: number;
}

export interface CachedProduct {
  id: string;
  account_id: string;
  name: string;
  sku: string | null;
  gtin: string | null;
  price_default: number;
  cost_default: number;
  unit: string;
  is_active: boolean;
  image_url?: string | null;
  cached_at: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('offline_sales')) {
        const store = db.createObjectStore('offline_sales', { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('store_id', 'store_id', { unique: false });
        store.createIndex('account_id', 'account_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('product_cache')) {
        const prodStore = db.createObjectStore('product_cache', { keyPath: 'id' });
        prodStore.createIndex('account_id', 'account_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('customer_cache')) {
        const custStore = db.createObjectStore('customer_cache', { keyPath: 'id' });
        custStore.createIndex('account_id', 'account_id', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txPromise<T>(tx: IDBTransaction, getResult: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(getResult());
    tx.onerror = () => reject(tx.error);
  });
}

function requestPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ==================== OFFLINE SALES ====================

export async function saveOfflineSale(sale: OfflineSale): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('offline_sales', 'readwrite');
  tx.objectStore('offline_sales').put(sale);
  await txPromise(tx, () => {});
}

export async function getOfflineSales(storeId?: string): Promise<OfflineSale[]> {
  const db = await openDB();
  const tx = db.transaction('offline_sales', 'readonly');
  const store = tx.objectStore('offline_sales');
  const all = await requestPromise(store.getAll());
  if (storeId) return all.filter(s => s.store_id === storeId);
  return all;
}

export async function getPendingSales(storeId?: string): Promise<OfflineSale[]> {
  const all = await getOfflineSales(storeId);
  return all.filter(s => s.status === 'pending' || s.status === 'error');
}

export async function updateOfflineSaleStatus(
  id: string,
  status: OfflineSaleStatus,
  extra?: Partial<OfflineSale>
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('offline_sales', 'readwrite');
  const store = tx.objectStore('offline_sales');
  const sale = await requestPromise(store.get(id));
  if (sale) {
    Object.assign(sale, { status, ...extra });
    store.put(sale);
  }
  await txPromise(tx, () => {});
}

export async function deleteOfflineSale(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('offline_sales', 'readwrite');
  tx.objectStore('offline_sales').delete(id);
  await txPromise(tx, () => {});
}

export async function clearSyncedSales(): Promise<void> {
  const all = await getOfflineSales();
  const db = await openDB();
  const tx = db.transaction('offline_sales', 'readwrite');
  const store = tx.objectStore('offline_sales');
  for (const sale of all) {
    if (sale.status === 'synced') store.delete(sale.id);
  }
  await txPromise(tx, () => {});
}

// ==================== PRODUCT CACHE ====================

export async function cacheProducts(products: CachedProduct[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('product_cache', 'readwrite');
  const store = tx.objectStore('product_cache');
  for (const p of products) store.put(p);
  await txPromise(tx, () => {});
}

export async function getCachedProducts(accountId: string): Promise<CachedProduct[]> {
  const db = await openDB();
  const tx = db.transaction('product_cache', 'readonly');
  const idx = tx.objectStore('product_cache').index('account_id');
  return requestPromise(idx.getAll(accountId));
}

export async function searchCachedProducts(accountId: string, query: string): Promise<CachedProduct[]> {
  const all = await getCachedProducts(accountId);
  if (!query.trim()) return all.slice(0, 50);
  const term = query.trim().toLowerCase();
  const isBarcode = /^\d{8,14}$/.test(term);
  if (isBarcode) {
    return all.filter(p => p.gtin === term || p.sku === term).slice(0, 10);
  }
  return all.filter(p =>
    p.name.toLowerCase().includes(term) ||
    (p.sku || '').toLowerCase().includes(term) ||
    (p.gtin || '').toLowerCase().includes(term)
  ).slice(0, 20);
}

// ==================== CUSTOMER CACHE ====================

export async function cacheCustomers(customers: { id: string; account_id: string; name: string; document?: string | null; phone?: string | null }[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('customer_cache', 'readwrite');
  const store = tx.objectStore('customer_cache');
  for (const c of customers) store.put({ ...c, cached_at: new Date().toISOString() });
  await txPromise(tx, () => {});
}

export async function getCachedCustomers(accountId: string): Promise<any[]> {
  const db = await openDB();
  const tx = db.transaction('customer_cache', 'readonly');
  const idx = tx.objectStore('customer_cache').index('account_id');
  return requestPromise(idx.getAll(accountId));
}
