CREATE OR REPLACE FUNCTION public.sales_status_inventory_apply(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record; v_account uuid; v_store uuid; v_status text; v_already int;
BEGIN
  SELECT account_id, store_id, status::text INTO v_account, v_store, v_status
  FROM public.sales WHERE id = _sale_id;
  IF v_status NOT IN ('paid','crediario') THEN RETURN; END IF;

  FOR r IN SELECT product_id, variant_id, qty FROM public.sale_items WHERE sale_id = _sale_id
  LOOP
    SELECT COUNT(*) INTO v_already FROM public.inventory_movements
    WHERE ref_id = _sale_id AND product_id = r.product_id
      AND variant_id IS NOT DISTINCT FROM r.variant_id AND type = 'sale';
    IF v_already = 0 THEN
      INSERT INTO public.inventory_movements(account_id, store_id, product_id, variant_id, type, qty, ref_table, ref_id)
      VALUES (v_account, v_store, r.product_id, r.variant_id, 'sale', -r.qty, 'sales', _sale_id);
    END IF;
  END LOOP;
END;
$$;