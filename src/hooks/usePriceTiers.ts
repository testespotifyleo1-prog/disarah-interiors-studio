import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PriceTier {
  product_id: string;
  min_qty: number;
  unit_price: number;
  label: string;
}

/**
 * Hook that loads price tiers for products in the cart
 * and provides a function to get the best price for a given qty.
 */
export function usePriceTiers(productIds: string[]) {
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const prevIdsRef = useRef<string>('');

  useEffect(() => {
    const key = productIds.sort().join(',');
    if (key === prevIdsRef.current || productIds.length === 0) return;
    prevIdsRef.current = key;

    const load = async () => {
      const { data } = await supabase
        .from('product_price_tiers')
        .select('product_id, min_qty, unit_price, label')
        .in('product_id', productIds)
        .eq('is_active', true)
        .order('min_qty', { ascending: false });
      setTiers((data as PriceTier[]) || []);
    };
    load();
  }, [productIds]);

  /**
   * Returns the best matching tier price for a product at the given qty.
   * Returns null if no tier matches (use default price).
   */
  const getTierPrice = (productId: string, qty: number): { price: number; label: string } | null => {
    const productTiers = tiers.filter(t => t.product_id === productId);
    // Already sorted desc by min_qty, find first match
    for (const t of productTiers) {
      if (qty >= t.min_qty) {
        return { price: t.unit_price, label: t.label };
      }
    }
    return null;
  };

  /**
   * Returns all tiers for a product (for badge display).
   */
  const getProductTiers = (productId: string) => {
    return tiers.filter(t => t.product_id === productId).sort((a, b) => a.min_qty - b.min_qty);
  };

  return { getTierPrice, getProductTiers, tiers };
}
