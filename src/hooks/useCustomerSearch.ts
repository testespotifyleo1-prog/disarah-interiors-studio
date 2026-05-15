import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Customer } from '@/types/database';

interface UseCustomerSearchOptions {
  accountId: string | undefined;
  limit?: number;
  debounceMs?: number;
}

export function useCustomerSearch({ accountId, limit = 30, debounceMs = 200 }: UseCustomerSearchOptions) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const allCustomersRef = useRef<Customer[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all customers once for instant local filtering
  const loadAll = useCallback(async () => {
    if (!accountId || allLoaded) return;
    setSearching(true);
    try {
      const all: Customer[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('account_id', accountId)
          .order('name')
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (data) {
          all.push(...(data as Customer[]));
          hasMore = data.length === batchSize;
          from += batchSize;
        } else {
          hasMore = false;
        }
      }
      allCustomersRef.current = all;
      setAllLoaded(true);
    } catch (e) {
      console.error('Error loading customers:', e);
    } finally {
      setSearching(false);
    }
  }, [accountId, allLoaded]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Filter locally with debounce
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    timerRef.current = setTimeout(() => {
      // Accent-insensitive normalization
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const term = norm(query.trim());
      // Remove formatting from document for matching
      const termClean = term.replace(/[.\-\/\s]/g, '');
      const isNumericTerm = /^\d+$/.test(termClean);
      // Split into words for multi-word matching ("maria apa" → ["maria", "apa"])
      const termWords = term.split(/\s+/).filter(Boolean);

      const filtered = allCustomersRef.current.filter(c => {
        const nameNorm = norm(c.name || '');
        const nameWords = nameNorm.split(/\s+/).filter(Boolean);

        // Name match: every typed word must be a prefix of some name word
        // ("ana" matches "Ana Silva" / "Maria Ana", NOT "Mariana"; "maria apa" matches "Maria Aparecida")
        const nameMatch = termWords.length > 0 && termWords.every(tw =>
          nameWords.some(w => w.startsWith(tw))
        );

        // Also allow substring match on full name for partial typing in the middle
        const nameContains = term.length >= 3 && nameNorm.includes(term);

        // Document: match anywhere (CPF/CNPJ are typed as full chunks)
        const docClean = (c.document || '').replace(/\D/g, '');
        const docMatch = isNumericTerm && termClean.length >= 3 && docClean.includes(termClean);

        // Phone: match anywhere by digits
        const phoneClean = (c.phone || '').replace(/\D/g, '');
        const phoneMatch = isNumericTerm && termClean.length >= 3 && phoneClean.includes(termClean);

        // Email: substring match
        const emailMatch = (c.email && term.length >= 2)
          ? norm(c.email).includes(term)
          : false;

        return nameMatch || nameContains || docMatch || phoneMatch || emailMatch;
      }).slice(0, limit);

      setResults(filtered);
      setSearching(false);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs, limit]);

  const refresh = useCallback(() => {
    setAllLoaded(false);
    allCustomersRef.current = [];
  }, []);

  return { query, setQuery, results, searching, allCustomers: allCustomersRef.current, allLoaded, refresh };
}
