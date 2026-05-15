import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/database';

interface UseProductSearchOptions {
  accountId: string | undefined;
  activeOnly?: boolean;
  limit?: number;
  debounceMs?: number;
}

// Detect if input looks like a barcode scan (numeric, 8-14 digits)
const isBarcodeLike = (term: string) => /^\d{8,14}$/.test(term);

export function useProductSearch({ accountId, activeOnly = true, limit = 20, debounceMs = 250 }: UseProductSearchOptions) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (!accountId || !q.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    try {
      const term = q.trim();
      const barcode = isBarcodeLike(term);

      if (barcode) {
        // Fast path: exact GTIN/SKU match first (uses index)
        let qb = supabase
          .from('products')
          .select('*')
          .eq('account_id', accountId)
          .or(`gtin.eq.${term},sku.eq.${term}`);
        if (activeOnly) qb = qb.eq('is_active', true);
        qb = qb.limit(5);

        const { data, error } = await qb;
        if (controller.signal.aborted) return;

        if (!error && data && data.length > 0) {
          setResults(data as Product[]);
          return;
        }

        // Also check variant GTINs/SKUs
        const { data: variants } = await supabase
          .from('product_variants')
          .select('product_id, id, sku, gtin, price, cost, attributes')
          .or(`gtin.eq.${term},sku.eq.${term}`)
          .eq('is_active', true)
          .limit(5);

        if (controller.signal.aborted) return;

        if (variants && variants.length > 0) {
          const productIds = [...new Set(variants.map(v => v.product_id))];
          const { data: products } = await supabase
            .from('products')
            .select('*')
            .in('id', productIds);
          if (controller.signal.aborted) return;
          if (products) {
            setResults(products as Product[]);
            return;
          }
        }

        // Also check presentation GTINs (fractioning)
        const { data: presentations } = await supabase
          .from('product_presentations')
          .select('product_id')
          .eq('gtin', term)
          .eq('is_active', true)
          .eq('is_sale', true)
          .limit(5);

        if (controller.signal.aborted) return;

        if (presentations && presentations.length > 0) {
          const prodIds = [...new Set(presentations.map((p: any) => p.product_id))];
          const { data: products } = await supabase
            .from('products')
            .select('*')
            .in('id', prodIds);
          if (controller.signal.aborted) return;
          if (products) {
            setResults(products as Product[]);
            return;
          }
        }
      }

      // Standard search path: ILIKE on name/sku/gtin
      let qb = supabase
        .from('products')
        .select('*')
        .eq('account_id', accountId);

      if (activeOnly) qb = qb.eq('is_active', true);

      const likeTerm = term.includes('%') ? term : `%${term}%`;
      qb = qb.or(`name.ilike.${likeTerm},sku.ilike.${likeTerm},gtin.ilike.${likeTerm}`);
      qb = qb.order('name').limit(limit);

      const { data, error } = await qb;
      if (controller.signal.aborted) return;

      if (!error && data) {
        setResults(data as Product[]);
      }
    } catch {
      // ignore abort errors
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, [accountId, activeOnly, limit]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    // Barcodes get near-instant search (50ms), text gets normal debounce
    const delay = isBarcodeLike(query.trim()) ? 50 : debounceMs;
    timerRef.current = setTimeout(() => search(query), delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, search, debounceMs]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { query, setQuery, results, searching };
}
