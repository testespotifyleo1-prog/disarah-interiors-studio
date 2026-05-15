
-- Auto-generate SKUs for all products that don't have one
DO $$
DECLARE
  r RECORD;
  v_next_num INT;
  v_sku TEXT;
BEGIN
  FOR r IN 
    SELECT DISTINCT account_id FROM public.products WHERE sku IS NULL OR sku = ''
  LOOP
    -- Get the current max SKU number for this account
    SELECT COALESCE(MAX(SUBSTRING(sku FROM 'SKU-(\d+)')::int), 0)
    INTO v_next_num
    FROM public.products
    WHERE account_id = r.account_id AND sku ~ '^SKU-\d+$';

    -- Update each product without SKU
    FOR r IN
      SELECT id FROM public.products 
      WHERE account_id = r.account_id AND (sku IS NULL OR sku = '')
      ORDER BY created_at
    LOOP
      v_next_num := v_next_num + 1;
      v_sku := 'SKU-' || LPAD(v_next_num::text, 4, '0');
      UPDATE public.products SET sku = v_sku WHERE id = r.id;
    END LOOP;
  END LOOP;
END $$;
