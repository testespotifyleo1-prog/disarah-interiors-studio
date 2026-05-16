-- Make inventory reconciliation ledger-safe: direct manual inventory edits become adjustment movements.

CREATE OR REPLACE FUNCTION public.reconcile_inventory_item(
  _account_id uuid,
  _store_id uuid,
  _product_id uuid,
  _variant_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  PERFORM set_config('app.inventory_reconcile', 'on', true);

  INSERT INTO public.inventory AS inv (account_id, store_id, product_id, variant_id, qty, qty_on_hand, updated_at)
  VALUES (_account_id, _store_id, _product_id, _variant_id, v_qty, v_qty, now())
  ON CONFLICT (store_id, product_id, variant_id)
  DO UPDATE SET
    account_id = EXCLUDED.account_id,
    qty = EXCLUDED.qty,
    qty_on_hand = EXCLUDED.qty_on_hand,
    updated_at = now();

  PERFORM set_config('app.inventory_reconcile', 'off', true);
END;
$$;

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

  PERFORM set_config('app.inventory_reconcile', 'on', true);

  RETURN QUERY
  WITH movement_keys AS (
    SELECT im.account_id, im.store_id, im.product_id, im.variant_id
      FROM public.inventory_movements im
     WHERE im.account_id = acc
       AND (_store_id IS NULL OR im.store_id = _store_id)
     GROUP BY im.account_id, im.store_id, im.product_id, im.variant_id
  ),
  inventory_keys AS (
    SELECT inv.account_id, inv.store_id, inv.product_id, inv.variant_id
      FROM public.inventory inv
     WHERE inv.account_id = acc
       AND (_store_id IS NULL OR inv.store_id = _store_id)
  ),
  keys AS (
    SELECT * FROM movement_keys
    UNION
    SELECT * FROM inventory_keys
  ),
  calc AS (
    SELECT
      k.account_id,
      k.store_id,
      k.product_id,
      k.variant_id,
      COALESCE(SUM(im.qty), 0)::numeric AS computed_qty
    FROM keys k
    LEFT JOIN public.inventory_movements im
      ON im.account_id = k.account_id
     AND im.store_id = k.store_id
     AND im.product_id = k.product_id
     AND im.variant_id IS NOT DISTINCT FROM k.variant_id
    GROUP BY k.account_id, k.store_id, k.product_id, k.variant_id
  ),
  upserted AS (
    INSERT INTO public.inventory AS inv (account_id, store_id, product_id, variant_id, qty, qty_on_hand, updated_at)
    SELECT c.account_id, c.store_id, c.product_id, c.variant_id, c.computed_qty, c.computed_qty, now()
      FROM calc c
    ON CONFLICT (store_id, product_id, variant_id)
    DO UPDATE SET qty = EXCLUDED.qty, qty_on_hand = EXCLUDED.qty_on_hand, updated_at = now()
    RETURNING inv.store_id AS s_id, inv.product_id AS p_id, inv.variant_id AS v_id, inv.qty AS new_qty
  )
  SELECT u.s_id, u.p_id, u.v_id, u.new_qty FROM upserted u;

  PERFORM set_config('app.inventory_reconcile', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_manual_adjustment_to_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desired_qty numeric;
  v_current_ledger_qty numeric;
  v_delta numeric;
BEGIN
  -- Reconciliation writes inventory from the movement ledger. Do not convert those writes back into movements.
  IF COALESCE(current_setting('app.inventory_reconcile', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.qty IS NOT DISTINCT FROM OLD.qty
     AND NEW.qty_on_hand IS NOT DISTINCT FROM OLD.qty_on_hand THEN
    RETURN NEW;
  END IF;

  v_desired_qty := COALESCE(NEW.qty, NEW.qty_on_hand, 0)::numeric;

  SELECT COALESCE(SUM(im.qty), 0)::numeric
    INTO v_current_ledger_qty
    FROM public.inventory_movements im
   WHERE im.account_id = NEW.account_id
     AND im.store_id = NEW.store_id
     AND im.product_id = NEW.product_id
     AND im.variant_id IS NOT DISTINCT FROM NEW.variant_id;

  v_delta := v_desired_qty - v_current_ledger_qty;

  IF v_delta <> 0 THEN
    INSERT INTO public.inventory_movements (
      account_id, store_id, product_id, variant_id, type, qty, ref_table, ref_id, notes, created_by
    ) VALUES (
      NEW.account_id,
      NEW.store_id,
      NEW.product_id,
      NEW.variant_id,
      'adjustment',
      v_delta,
      'inventory',
      NEW.id,
      'Ajuste automático gerado por edição manual do saldo de estoque',
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_manual_adjustment ON public.inventory;
CREATE TRIGGER trg_inventory_manual_adjustment
AFTER INSERT OR UPDATE OF qty, qty_on_hand ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.inventory_manual_adjustment_to_movement();

GRANT EXECUTE ON FUNCTION public.reconcile_inventory_item(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_inventory(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.run_inventory_tests()
RETURNS TABLE(test_name text, passed boolean, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account uuid := public.current_account_id();
  v_store uuid := public.current_store_id();
  v_user uuid := '00000000-0000-4000-a000-000000000099'::uuid;
  v_product uuid;
  v_sale uuid;
  v_qty numeric;
  v_mov_count int;
BEGIN
  -- Product without variant_id: manual inventory 5 -> sale 2 -> cancel -> back to 5.
  v_product := gen_random_uuid();
  INSERT INTO public.products (id, account_id, sku, name, unit, price_default, cost_default, is_active)
  VALUES (v_product, v_account, 'TEST-INV-MANUAL-NULL', 'Teste estoque manual sem variação', 'un', 10, 5, true);

  INSERT INTO public.inventory (account_id, store_id, product_id, variant_id, qty, qty_on_hand, min_qty)
  VALUES (v_account, v_store, v_product, NULL, 5, 5, 0);

  SELECT qty INTO v_qty FROM public.inventory
  WHERE store_id = v_store AND product_id = v_product AND variant_id IS NULL;
  test_name := 'edição manual gera saldo inicial com variant_id nulo';
  passed := v_qty = 5;
  details := 'saldo=' || COALESCE(v_qty::text, 'null');
  RETURN NEXT;

  SELECT COUNT(*) INTO v_mov_count FROM public.inventory_movements
  WHERE store_id = v_store AND product_id = v_product AND variant_id IS NULL AND type = 'adjustment' AND qty = 5;
  test_name := 'edição manual gera movimento de ajuste +5';
  passed := v_mov_count = 1;
  details := 'movimentos=' || v_mov_count;
  RETURN NEXT;

  v_sale := gen_random_uuid();
  INSERT INTO public.sales (id, account_id, store_id, seller_id, status, subtotal, discount, total)
  VALUES (v_sale, v_account, v_store, v_user, 'open', 20, 0, 20);
  INSERT INTO public.sale_items (account_id, sale_id, product_id, variant_id, qty, unit_price, unit_cost, total_line)
  VALUES (v_account, v_sale, v_product, NULL, 2, 10, 5, 20);

  UPDATE public.sales SET status = 'paid' WHERE id = v_sale;

  SELECT qty INTO v_qty FROM public.inventory
  WHERE store_id = v_store AND product_id = v_product AND variant_id IS NULL;
  test_name := 'venda de 2 desconta do saldo manual 5';
  passed := v_qty = 3;
  details := 'saldo=' || COALESCE(v_qty::text, 'null');
  RETURN NEXT;

  PERFORM public.cancel_sale(_sale_id => v_sale, _reason => 'teste estorno', _user_id => v_user);

  SELECT qty INTO v_qty FROM public.inventory
  WHERE store_id = v_store AND product_id = v_product AND variant_id IS NULL;
  test_name := 'cancelamento devolve 2 e preserva estoque inicial 5';
  passed := v_qty = 5;
  details := 'saldo=' || COALESCE(v_qty::text, 'null');
  RETURN NEXT;

  SELECT COUNT(*) INTO v_mov_count FROM public.inventory_movements
  WHERE store_id = v_store AND product_id = v_product AND variant_id IS NULL AND ref_id = v_sale;
  test_name := 'venda cancelada tem apenas baixa e estorno, sem ajuste duplicado';
  passed := v_mov_count = 2;
  details := 'movimentos_venda=' || v_mov_count;
  RETURN NEXT;

  RAISE EXCEPTION 'rollback inventory tests';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'rollback inventory tests' THEN
    RETURN;
  END IF;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_inventory_tests() TO authenticated;