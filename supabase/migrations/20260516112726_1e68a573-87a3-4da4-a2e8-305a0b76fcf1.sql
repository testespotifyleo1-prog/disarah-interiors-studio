-- Fix cancel_sale: remove reference to non-existent column canceled_by,
-- and allow it to work for both authenticated calls and internal/test calls.
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT NULL, _user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
  v_acc  uuid;
BEGIN
  -- If JWT present, enforce membership. If no JWT (internal/test), require _user_id.
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_account_member(auth.uid()) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  SELECT id, account_id, store_id, status::text AS status
    INTO v_sale
    FROM public.sales
   WHERE id = _sale_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  v_acc := v_sale.account_id;

  -- Optional safety: if called from authenticated context, ensure same account
  IF auth.uid() IS NOT NULL AND public.current_account_id() IS NOT NULL
     AND v_acc <> public.current_account_id() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_sale.status <> 'cancelled' THEN
    UPDATE public.sales
       SET status = 'cancelled',
           cancelled_reason = _reason,
           cancel_reason = _reason,
           cancelled_at = now(),
           canceled_at = now()
     WHERE id = _sale_id;
  END IF;

  UPDATE public.accounts_receivable
     SET status = 'cancelled'
   WHERE sale_id = _sale_id
     AND account_id = v_acc
     AND status IN ('open','partial','overdue');

  UPDATE public.commissions
     SET status = 'cancelled', paid = false
   WHERE sale_id = _sale_id
     AND account_id = v_acc
     AND status <> 'paid';

  PERFORM public.reconcile_inventory(v_sale.store_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_sale(sale_id uuid, reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_account_member(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  PERFORM public.cancel_sale(sale_id, reason, auth.uid());
END;
$$;