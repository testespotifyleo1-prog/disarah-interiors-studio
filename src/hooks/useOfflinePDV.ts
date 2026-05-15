/**
 * useOfflinePDV - Hook for offline PDV capabilities.
 * Handles product caching, offline sale creation, and sync triggers.
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import {
  saveOfflineSale,
  cacheProducts,
  cacheCustomers,
  searchCachedProducts,
  getCachedCustomers,
  type OfflineSale,
  type OfflineSaleItem,
  type OfflinePayment,
  type CachedProduct,
} from '@/services/offlineStore';

interface UseOfflinePDVOptions {
  accountId?: string;
  storeId?: string;
  userId?: string;
  userEmail?: string;
}

export function useOfflinePDV({ accountId, storeId, userId, userEmail }: UseOfflinePDVOptions) {
  const { isOnline, status } = useOnlineStatus();
  const cacheLoadedRef = useRef(false);

  // Pre-cache products and customers when online
  useEffect(() => {
    if (!isOnline || !accountId || cacheLoadedRef.current) return;

    const cacheData = async () => {
      try {
        // Cache products (all active, paginated)
        const allProducts: CachedProduct[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('products')
            .select('id, account_id, name, sku, gtin, price_default, cost_default, unit, is_active, image_url')
            .eq('account_id', accountId)
            .eq('is_active', true)
            .range(from, from + batchSize - 1);
          if (error) break;
          if (data) {
            allProducts.push(...data.map(p => ({ ...p, sku: p.sku || null, gtin: p.gtin || null, image_url: p.image_url || null, cached_at: new Date().toISOString() })));
            hasMore = data.length === batchSize;
            from += batchSize;
          } else hasMore = false;
        }
        if (allProducts.length > 0) await cacheProducts(allProducts);

        // Cache customers
        const allCustomers: any[] = [];
        from = 0;
        hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('customers')
            .select('id, account_id, name, document, phone')
            .eq('account_id', accountId)
            .range(from, from + batchSize - 1);
          if (error) break;
          if (data) {
            allCustomers.push(...data);
            hasMore = data.length === batchSize;
            from += batchSize;
          } else hasMore = false;
        }
        if (allCustomers.length > 0) await cacheCustomers(allCustomers);

        cacheLoadedRef.current = true;
      } catch (e) {
        console.error('Error caching offline data:', e);
      }
    };

    cacheData();
  }, [isOnline, accountId]);

  const searchOfflineProducts = useCallback(async (query: string) => {
    if (!accountId) return [];
    return searchCachedProducts(accountId, query);
  }, [accountId]);

  const getOfflineCustomers = useCallback(async () => {
    if (!accountId) return [];
    return getCachedCustomers(accountId);
  }, [accountId]);

  const createOfflineSale = useCallback(async (params: {
    customerId: string | null;
    customerName: string | null;
    discount: number;
    deliveryFee: number;
    assemblyFee?: number;
    subtotal: number;
    total: number;
    notes: string | null;
    items: OfflineSaleItem[];
    payments: OfflinePayment[];
  }): Promise<string> => {
    if (!accountId || !storeId || !userId) throw new Error('Dados de sessão não disponíveis');

    const offlineSale: OfflineSale = {
      id: crypto.randomUUID(),
      account_id: accountId,
      store_id: storeId,
      seller_id: userId,
      seller_email: userEmail || '',
      customer_id: params.customerId,
      customer_name: params.customerName,
      discount: params.discount,
      delivery_fee: params.deliveryFee,
      assembly_fee: params.assemblyFee || 0,
      subtotal: params.subtotal,
      total: params.total,
      notes: params.notes,
      items: params.items,
      payments: params.payments,
      created_at: new Date().toISOString(),
      status: 'pending',
      sync_attempts: 0,
    };

    await saveOfflineSale(offlineSale);
    return offlineSale.id;
  }, [accountId, storeId, userId, userEmail]);

  return {
    isOnline,
    connectionStatus: status,
    searchOfflineProducts,
    getOfflineCustomers,
    createOfflineSale,
  };
}
