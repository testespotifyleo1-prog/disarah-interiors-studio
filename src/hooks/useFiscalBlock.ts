import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CartItemLite {
  product: { id: string; name: string; ncm?: string | null; cfop_default?: string | null };
}

/**
 * Hook que carrega a flag `block_sale_without_fiscal_data` da loja
 * e expõe um validador que retorna a lista de produtos sem NCM/CFOP.
 */
export function useFiscalBlock(storeId: string | undefined) {
  const [blockEnabled, setBlockEnabled] = useState(false);

  useEffect(() => {
    if (!storeId) { setBlockEnabled(false); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('focus_nfe_settings')
        .select('block_sale_without_fiscal_data, is_active')
        .eq('store_id', storeId)
        .maybeSingle();
      if (alive) setBlockEnabled(Boolean(data?.is_active && (data as any)?.block_sale_without_fiscal_data));
    })();
    return () => { alive = false; };
  }, [storeId]);

  function validateCart<T extends CartItemLite>(cart: T[]) {
    const missing = cart.filter(i => {
      const p = i.product as any;
      return !p?.ncm || String(p.ncm).replace(/\D/g, '').length < 8 || !p?.cfop_default;
    }).map(i => i.product.name);
    return { ok: missing.length === 0, missing };
  }

  return { blockEnabled, validateCart };
}
