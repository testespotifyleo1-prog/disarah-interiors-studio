
-- 1) cancel_sale: dispara reconciliação ao final
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT NULL::text, _user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_account_member(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT store_id INTO v_store FROM public.sales
   WHERE id = _sale_id AND account_id = public.current_account_id();

  UPDATE public.sales
     SET status = 'cancelled',
         cancelled_reason = _reason,
         cancelled_at = now()
   WHERE id = _sale_id
     AND account_id = public.current_account_id();

  UPDATE public.accounts_receivable
     SET status = 'cancelled'
   WHERE sale_id = _sale_id
     AND account_id = public.current_account_id()
     AND status IN ('open','partial','overdue');

  UPDATE public.commissions
     SET status = 'cancelled', paid = false
   WHERE sale_id = _sale_id
     AND account_id = public.current_account_id()
     AND status <> 'paid';

  -- Reconcilia estoque da loja após o cancelamento
  PERFORM public.reconcile_inventory(v_store);
END
$function$;

-- 2) Trigger em inventory_movements para reconciliar após estornos
CREATE OR REPLACE FUNCTION public.inv_mov_auto_reconcile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type IN ('return_in','adjustment') THEN
    UPDATE public.inventory inv
       SET qty = (
         SELECT COALESCE(SUM(im.qty),0)
           FROM public.inventory_movements im
          WHERE im.account_id = NEW.account_id
            AND im.store_id  = NEW.store_id
            AND im.product_id = NEW.product_id
            AND COALESCE(im.variant_id::text,'') = COALESCE(NEW.variant_id::text,'')
       ),
       updated_at = now()
     WHERE inv.account_id = NEW.account_id
       AND inv.store_id   = NEW.store_id
       AND inv.product_id = NEW.product_id
       AND COALESCE(inv.variant_id::text,'') = COALESCE(NEW.variant_id::text,'');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_inv_mov_auto_reconcile ON public.inventory_movements;
CREATE TRIGGER trg_inv_mov_auto_reconcile
AFTER INSERT ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.inv_mov_auto_reconcile();
