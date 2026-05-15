-- 1) Fix the two Miranda e Miranda sales with year 1926 (typo => correct to 2026)
UPDATE public.sales
SET created_at = created_at + INTERVAL '100 years',
    updated_at = now()
WHERE id IN ('52dbf778-59ab-4cb4-b45d-0cb3d58a2e63', '45cab2c2-9fa1-449c-954f-eebff99ca81b')
  AND EXTRACT(YEAR FROM created_at) = 1926;

-- 2) Remove orphan payments from the canceled sale #285 (Miranda e Farias)
DELETE FROM public.payments
WHERE sale_id = '02a9aa07-b7a6-438d-aaca-04285fe6f841';

-- 3) Update cancel_sale function so cancellations always remove payments
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _user_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;

  IF NOT has_account_role(_user_id, v_sale.account_id, ARRAY['owner'::account_role, 'admin'::account_role]) THEN
    RAISE EXCEPTION 'Apenas admin/dono pode cancelar vendas';
  END IF;

  IF v_sale.status = 'canceled' THEN
    RAISE EXCEPTION 'Venda já está cancelada';
  END IF;

  -- Reverse inventory if sale was paid
  IF v_sale.status = 'paid' THEN
    FOR v_item IN SELECT product_id, qty FROM public.sale_items WHERE sale_id = _sale_id
    LOOP
      UPDATE public.inventory
      SET qty_on_hand = qty_on_hand + v_item.qty, updated_at = now()
      WHERE store_id = v_sale.store_id AND product_id = v_item.product_id;
    END LOOP;
  END IF;

  -- Remove payments to keep cash/dashboard consistent
  DELETE FROM public.payments WHERE sale_id = _sale_id;

  UPDATE public.commissions SET status = 'canceled' WHERE sale_id = _sale_id;
  UPDATE public.accounts_receivable SET status = 'canceled' WHERE sale_id = _sale_id;
  UPDATE public.deliveries SET status = 'canceled' WHERE sale_id = _sale_id;
  UPDATE public.assemblies SET status = 'canceled' WHERE sale_id = _sale_id;

  UPDATE public.sales
  SET status = 'canceled',
      canceled_by = _user_id,
      canceled_at = now(),
      cancel_reason = _reason,
      updated_at = now()
  WHERE id = _sale_id;
END;
$function$;