-- Centraliza a reconciliação de um item específico do estoque a partir das movimentações
CREATE OR REPLACE FUNCTION public.reconcile_inventory_item(
  _account_id uuid,
  _store_id uuid,
  _product_id uuid,
  _variant_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_qty numeric;
BEGIN
  IF _account_id IS NULL OR _store_id IS NULL OR _product_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(im.qty), 0)::numeric
    INTO v_qty
    FROM public.inventory_movements im
   WHERE im.account_id = _account_id
     AND im.store_id = _store_id
     AND im.product_id = _product_id
     AND im.variant_id IS NOT DISTINCT FROM _variant_id;

  INSERT INTO public.inventory AS inv (account_id, store_id, product_id, variant_id, qty, updated_at)
  VALUES (_account_id, _store_id, _product_id, _variant_id, v_qty, now())
  ON CONFLICT (store_id, product_id, variant_id)
  DO UPDATE SET
    account_id = EXCLUDED.account_id,
    qty = EXCLUDED.qty,
    updated_at = now();
END
$function$;

-- Recalcula o saldo do item afetado sempre que uma movimentação muda
CREATE OR REPLACE FUNCTION public.inv_mov_auto_reconcile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    r := OLD;
  ELSE
    r := NEW;
  END IF;

  PERFORM public.reconcile_inventory_item(r.account_id, r.store_id, r.product_id, r.variant_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_inv_mov_auto_reconcile ON public.inventory_movements;
CREATE TRIGGER trg_inv_mov_auto_reconcile
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.inv_mov_auto_reconcile();

-- Garante baixa para venda paga ou crediário e estorno para cancelamento de ambas
CREATE OR REPLACE FUNCTION public.sales_status_inventory()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_existing numeric;
  v_missing numeric;
  v_was_finalized boolean;
  v_is_finalized boolean;
BEGIN
  v_was_finalized := OLD.status IN ('paid', 'crediario');
  v_is_finalized := NEW.status IN ('paid', 'crediario');

  -- Ao finalizar a venda, registra a baixa no livro de estoque.
  IF v_is_finalized AND NOT v_was_finalized THEN
    FOR r IN
      SELECT
        si.product_id,
        si.variant_id,
        COALESCE(SUM(si.qty), 0)::numeric AS qty,
        MAX(COALESCE(si.cost_at_sale, si.unit_cost, 0))::numeric AS unit_cost
      FROM public.sale_items si
      WHERE si.sale_id = NEW.id
      GROUP BY si.product_id, si.variant_id
    LOOP
      SELECT COALESCE(-SUM(im.qty), 0)::numeric
        INTO v_existing
        FROM public.inventory_movements im
       WHERE im.account_id = NEW.account_id
         AND im.store_id = NEW.store_id
         AND im.product_id = r.product_id
         AND im.variant_id IS NOT DISTINCT FROM r.variant_id
         AND im.type = 'sale'
         AND im.ref_table = 'sales'
         AND im.ref_id = NEW.id;

      v_missing := r.qty - v_existing;

      IF v_missing > 0 THEN
        INSERT INTO public.inventory_movements (
          account_id, store_id, product_id, variant_id, type, qty, unit_cost, ref_table, ref_id
        ) VALUES (
          NEW.account_id, NEW.store_id, r.product_id, r.variant_id, 'sale', -v_missing, r.unit_cost, 'sales', NEW.id
        );
      END IF;
    END LOOP;

    IF NEW.status = 'paid' THEN
      NEW.paid_at := COALESCE(NEW.paid_at, now());
    END IF;

  -- Ao cancelar venda já finalizada, registra o estorno no livro de estoque.
  ELSIF NEW.status = 'cancelled' AND v_was_finalized THEN
    FOR r IN
      SELECT
        si.product_id,
        si.variant_id,
        COALESCE(SUM(si.qty), 0)::numeric AS qty
      FROM public.sale_items si
      WHERE si.sale_id = NEW.id
      GROUP BY si.product_id, si.variant_id
    LOOP
      SELECT COALESCE(SUM(im.qty), 0)::numeric
        INTO v_existing
        FROM public.inventory_movements im
       WHERE im.account_id = NEW.account_id
         AND im.store_id = NEW.store_id
         AND im.product_id = r.product_id
         AND im.variant_id IS NOT DISTINCT FROM r.variant_id
         AND im.type = 'return_in'
         AND im.ref_table = 'sales'
         AND im.ref_id = NEW.id;

      v_missing := r.qty - v_existing;

      IF v_missing > 0 THEN
        INSERT INTO public.inventory_movements (
          account_id, store_id, product_id, variant_id, type, qty, ref_table, ref_id
        ) VALUES (
          NEW.account_id, NEW.store_id, r.product_id, r.variant_id, 'return_in', v_missing, 'sales', NEW.id
        );
      END IF;
    END LOOP;

    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    NEW.canceled_at := COALESCE(NEW.canceled_at, NEW.cancelled_at);
  END IF;

  RETURN NEW;
END
$function$;

-- Cancela a venda usando a transição de status para acionar o estorno pelo gatilho acima
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT NULL::text, _user_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_account_member(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id, account_id, store_id, status
    INTO v_sale
    FROM public.sales
   WHERE id = _sale_id
     AND account_id = public.current_account_id()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  IF v_sale.status <> 'cancelled' THEN
    UPDATE public.sales
       SET status = 'cancelled',
           cancelled_reason = _reason,
           cancel_reason = _reason,
           cancelled_at = now(),
           canceled_at = now(),
           canceled_by = COALESCE(_user_id, auth.uid())
     WHERE id = _sale_id
       AND account_id = public.current_account_id();
  END IF;

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

  PERFORM public.reconcile_inventory(v_sale.store_id);
END
$function$;

CREATE OR REPLACE FUNCTION public.cancel_sale(sale_id uuid, reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_account_member(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.cancel_sale(sale_id, reason, auth.uid());
END
$function$;