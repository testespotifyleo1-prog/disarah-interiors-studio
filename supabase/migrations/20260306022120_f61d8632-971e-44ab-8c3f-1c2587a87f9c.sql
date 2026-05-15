
-- 1. Add delivery_fee and cancellation fields to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS canceled_by uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancel_reason text;

-- 2. Add 'canceled' to commission_status enum
ALTER TYPE public.commission_status ADD VALUE IF NOT EXISTS 'canceled';

-- 3. Create cancel_sale function with all reversals
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _user_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- 1. Reverse inventory if sale was paid
  IF v_sale.status = 'paid' THEN
    FOR v_item IN SELECT product_id, qty FROM public.sale_items WHERE sale_id = _sale_id
    LOOP
      UPDATE public.inventory
      SET qty_on_hand = qty_on_hand + v_item.qty, updated_at = now()
      WHERE store_id = v_sale.store_id AND product_id = v_item.product_id;
    END LOOP;
  END IF;

  -- 2. Cancel commissions
  UPDATE public.commissions SET status = 'canceled' WHERE sale_id = _sale_id;

  -- 3. Cancel accounts_receivable
  UPDATE public.accounts_receivable SET status = 'canceled' WHERE sale_id = _sale_id;

  -- 4. Cancel deliveries
  UPDATE public.deliveries SET status = 'canceled' WHERE sale_id = _sale_id;

  -- 5. Cancel assemblies
  UPDATE public.assemblies SET status = 'canceled' WHERE sale_id = _sale_id;

  -- 6. Update sale
  UPDATE public.sales
  SET status = 'canceled',
      canceled_by = _user_id,
      canceled_at = now(),
      cancel_reason = _reason,
      updated_at = now()
  WHERE id = _sale_id;
END;
$$;
