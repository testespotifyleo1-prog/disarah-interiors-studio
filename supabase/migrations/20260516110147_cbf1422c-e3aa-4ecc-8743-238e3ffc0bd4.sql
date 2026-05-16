
DROP FUNCTION IF EXISTS public.reconcile_inventory(uuid);

CREATE OR REPLACE FUNCTION public.reconcile_inventory(_store_id uuid DEFAULT NULL)
RETURNS TABLE(out_store_id uuid, out_product_id uuid, out_variant_id uuid, out_new_qty numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc uuid := public.current_account_id();
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_account_member(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH calc AS (
    SELECT
      im.store_id AS s_id,
      im.product_id AS p_id,
      im.variant_id AS v_id,
      COALESCE(SUM(im.qty), 0)::numeric AS computed_qty
    FROM public.inventory_movements im
    WHERE im.account_id = acc
      AND (_store_id IS NULL OR im.store_id = _store_id)
    GROUP BY im.store_id, im.product_id, im.variant_id
  ),
  upserted AS (
    INSERT INTO public.inventory AS inv (account_id, store_id, product_id, variant_id, qty, updated_at)
    SELECT acc, c.s_id, c.p_id, c.v_id, c.computed_qty, now()
    FROM calc c
    ON CONFLICT (store_id, product_id, variant_id)
    DO UPDATE SET qty = EXCLUDED.qty, updated_at = now()
    RETURNING inv.store_id AS s_id, inv.product_id AS p_id, inv.variant_id AS v_id, inv.qty AS new_qty
  )
  SELECT u.s_id, u.p_id, u.v_id, u.new_qty FROM upserted u;

  UPDATE public.inventory inv
     SET qty = 0, updated_at = now()
   WHERE inv.account_id = acc
     AND (_store_id IS NULL OR inv.store_id = _store_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.inventory_movements im
        WHERE im.account_id = acc
          AND im.store_id = inv.store_id
          AND im.product_id = inv.product_id
          AND COALESCE(im.variant_id::text,'') = COALESCE(inv.variant_id::text,'')
     )
     AND inv.qty <> 0;
END
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_inventory(uuid) TO authenticated, anon;
