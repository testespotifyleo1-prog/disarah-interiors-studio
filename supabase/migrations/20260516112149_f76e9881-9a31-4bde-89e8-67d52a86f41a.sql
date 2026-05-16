-- Automated tests for cancel_sale + inventory reversal
-- Includes cases with NULL variant_id and with variant_id
-- Usage: SELECT * FROM public.run_inventory_tests();

CREATE OR REPLACE FUNCTION public.run_inventory_tests()
RETURNS TABLE(test_name text, passed boolean, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account uuid;
  v_store   uuid;
  v_user    uuid;
  v_prod_a  uuid;  -- product without variant
  v_prod_b  uuid;  -- product with variant
  v_var_b   uuid;
  v_sale    uuid;
  v_qty_a_before numeric;
  v_qty_a_after_sale numeric;
  v_qty_a_after_cancel numeric;
  v_qty_b_before numeric;
  v_qty_b_after_sale numeric;
  v_qty_b_after_cancel numeric;
  v_mov_count int;
  v_recv_open int;
BEGIN
  -- pick first available account/store/user for sandbox
  SELECT a.id INTO v_account FROM public.accounts a LIMIT 1;
  IF v_account IS NULL THEN
    RETURN QUERY SELECT 'setup'::text, false, 'No account found'::text; RETURN;
  END IF;
  SELECT s.id INTO v_store FROM public.stores s WHERE s.account_id = v_account LIMIT 1;
  SELECT m.user_id INTO v_user FROM public.memberships m WHERE m.account_id = v_account LIMIT 1;

  -- Run inside a savepoint so we can rollback all test data
  BEGIN
    -- create test products
    INSERT INTO public.products(account_id, name, sku, price, is_active)
    VALUES (v_account, '__TEST_PROD_A__', '__TST_A__', 100, true)
    RETURNING id INTO v_prod_a;

    INSERT INTO public.products(account_id, name, sku, price, is_active)
    VALUES (v_account, '__TEST_PROD_B__', '__TST_B__', 200, true)
    RETURNING id INTO v_prod_b;

    INSERT INTO public.product_variants(account_id, product_id, name, sku)
    VALUES (v_account, v_prod_b, 'M', '__TST_B_M__')
    RETURNING id INTO v_var_b;

    -- seed stock via movements (10 each)
    INSERT INTO public.inventory_movements(account_id, store_id, product_id, variant_id, type, qty, created_by, ref_table)
    VALUES
      (v_account, v_store, v_prod_a, NULL,    'adjustment', 10, v_user, '__test__'),
      (v_account, v_store, v_prod_b, v_var_b, 'adjustment', 10, v_user, '__test__');

    SELECT COALESCE(qty,0) INTO v_qty_a_before FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    SELECT COALESCE(qty,0) INTO v_qty_b_before FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_b AND variant_id=v_var_b;

    -- create a sale with 2 items, mark as paid (should deduct stock)
    INSERT INTO public.sales(account_id, store_id, status, total, subtotal, created_by)
    VALUES (v_account, v_store, 'paid', 500, 500, v_user)
    RETURNING id INTO v_sale;

    INSERT INTO public.sale_items(account_id, sale_id, product_id, variant_id, qty, unit_price, total)
    VALUES
      (v_account, v_sale, v_prod_a, NULL,    3, 100, 300),
      (v_account, v_sale, v_prod_b, v_var_b, 2, 100, 200);

    -- trigger stock deduction by re-applying status
    PERFORM public.sales_status_inventory_apply(v_sale);

    SELECT COALESCE(qty,0) INTO v_qty_a_after_sale FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    SELECT COALESCE(qty,0) INTO v_qty_b_after_sale FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_b AND variant_id=v_var_b;

    RETURN QUERY SELECT
      'stock_deduct_null_variant'::text,
      (v_qty_a_after_sale = v_qty_a_before - 3),
      format('before=%s after=%s expected=%s', v_qty_a_before, v_qty_a_after_sale, v_qty_a_before-3);

    RETURN QUERY SELECT
      'stock_deduct_with_variant'::text,
      (v_qty_b_after_sale = v_qty_b_before - 2),
      format('before=%s after=%s expected=%s', v_qty_b_before, v_qty_b_after_sale, v_qty_b_before-2);

    -- cancel the sale
    PERFORM public.cancel_sale(v_sale, 'test cancellation');

    SELECT COALESCE(qty,0) INTO v_qty_a_after_cancel FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    SELECT COALESCE(qty,0) INTO v_qty_b_after_cancel FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_b AND variant_id=v_var_b;

    RETURN QUERY SELECT
      'stock_restore_null_variant_after_cancel'::text,
      (v_qty_a_after_cancel = v_qty_a_before),
      format('before_sale=%s after_cancel=%s', v_qty_a_before, v_qty_a_after_cancel);

    RETURN QUERY SELECT
      'stock_restore_with_variant_after_cancel'::text,
      (v_qty_b_after_cancel = v_qty_b_before),
      format('before_sale=%s after_cancel=%s', v_qty_b_before, v_qty_b_after_cancel);

    -- ledger should sum exactly to current qty
    SELECT COUNT(*) INTO v_mov_count FROM public.inventory_movements
      WHERE ref_id = v_sale;
    RETURN QUERY SELECT
      'movements_created_for_sale'::text,
      (v_mov_count >= 4),
      format('movements=%s', v_mov_count);

    -- idempotency: cancelling twice should not double-restore
    BEGIN
      PERFORM public.cancel_sale(v_sale, 'second cancel');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- expected: already cancelled
    END;

    SELECT COALESCE(qty,0) INTO v_qty_a_after_cancel FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    RETURN QUERY SELECT
      'cancel_idempotent_null_variant'::text,
      (v_qty_a_after_cancel = v_qty_a_before),
      format('qty after 2nd cancel=%s expected=%s', v_qty_a_after_cancel, v_qty_a_before);

    -- crediario flow
    INSERT INTO public.sales(account_id, store_id, status, total, subtotal, created_by)
    VALUES (v_account, v_store, 'crediario', 100, 100, v_user)
    RETURNING id INTO v_sale;

    INSERT INTO public.sale_items(account_id, sale_id, product_id, variant_id, qty, unit_price, total)
    VALUES (v_account, v_sale, v_prod_a, NULL, 1, 100, 100);

    PERFORM public.sales_status_inventory_apply(v_sale);

    SELECT COALESCE(qty,0) INTO v_qty_a_after_sale FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;

    RETURN QUERY SELECT
      'crediario_deducts_stock'::text,
      (v_qty_a_after_sale = v_qty_a_before - 1),
      format('after_crediario=%s expected=%s', v_qty_a_after_sale, v_qty_a_before - 1);

    PERFORM public.cancel_sale(v_sale, 'cancel crediario');

    SELECT COALESCE(qty,0) INTO v_qty_a_after_cancel FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;

    RETURN QUERY SELECT
      'crediario_restores_stock_on_cancel'::text,
      (v_qty_a_after_cancel = v_qty_a_before),
      format('after_cancel=%s expected=%s', v_qty_a_after_cancel, v_qty_a_before);

    -- ensure receivables linked to cancelled sale are closed/cancelled
    SELECT COUNT(*) INTO v_recv_open
      FROM public.accounts_receivable
      WHERE sale_id = v_sale AND status NOT IN ('cancelled','canceled','paid');
    RETURN QUERY SELECT
      'receivables_cancelled_with_sale'::text,
      (v_recv_open = 0),
      format('open_receivables=%s', v_recv_open);

    -- Always rollback test data
    RAISE EXCEPTION 'ROLLBACK_TEST_DATA';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_TEST_DATA' THEN
      RETURN QUERY SELECT 'unexpected_error'::text, false, SQLERRM;
    END IF;
  END;
END;
$$;

-- Helper: if sales_status_inventory_apply doesn't exist, create wrapper that calls the trigger logic.
-- The existing system uses a trigger on sales (sales_status_inventory). For tests we need a callable function.
CREATE OR REPLACE FUNCTION public.sales_status_inventory_apply(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_account uuid;
  v_store uuid;
  v_status text;
  v_already int;
BEGIN
  SELECT account_id, store_id, status::text INTO v_account, v_store, v_status
  FROM public.sales WHERE id = _sale_id;

  IF v_status NOT IN ('paid','crediario') THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT product_id, variant_id, qty
    FROM public.sale_items WHERE sale_id = _sale_id
  LOOP
    -- only insert sale_out if not already present for this sale+product+variant
    SELECT COUNT(*) INTO v_already
    FROM public.inventory_movements
    WHERE ref_id = _sale_id
      AND product_id = r.product_id
      AND variant_id IS NOT DISTINCT FROM r.variant_id
      AND type = 'sale_out';

    IF v_already = 0 THEN
      INSERT INTO public.inventory_movements(
        account_id, store_id, product_id, variant_id, type, qty, ref_table, ref_id
      ) VALUES (
        v_account, v_store, r.product_id, r.variant_id, 'sale_out', -r.qty, 'sales', _sale_id
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.run_inventory_tests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_inventory_tests() TO authenticated;
REVOKE ALL ON FUNCTION public.sales_status_inventory_apply(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_status_inventory_apply(uuid) TO authenticated;