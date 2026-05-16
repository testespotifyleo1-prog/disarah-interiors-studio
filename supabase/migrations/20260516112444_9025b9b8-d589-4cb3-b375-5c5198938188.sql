CREATE OR REPLACE FUNCTION public.run_inventory_tests()
RETURNS TABLE(test_name text, passed boolean, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account uuid; v_store uuid; v_user uuid;
  v_prod_a uuid; v_prod_b uuid; v_var_b uuid; v_sale uuid;
  v_qty_a_before numeric; v_qty_a_after_sale numeric; v_qty_a_after_cancel numeric;
  v_qty_b_before numeric; v_qty_b_after_sale numeric; v_qty_b_after_cancel numeric;
  v_mov_count int; v_recv_open int;
BEGIN
  SELECT a.id INTO v_account FROM public.accounts a LIMIT 1;
  IF v_account IS NULL THEN RETURN QUERY SELECT 'setup'::text, false, 'No account'::text; RETURN; END IF;
  SELECT s.id INTO v_store FROM public.stores s WHERE s.account_id = v_account LIMIT 1;
  SELECT m.user_id INTO v_user FROM public.memberships m WHERE m.account_id = v_account LIMIT 1;

  BEGIN
    INSERT INTO public.products(account_id, name, sku, price_default, cost_default, is_active)
    VALUES (v_account, '__TEST_PROD_A__', '__TST_A__'||gen_random_uuid()::text, 100, 50, true) RETURNING id INTO v_prod_a;
    INSERT INTO public.products(account_id, name, sku, price_default, cost_default, is_active)
    VALUES (v_account, '__TEST_PROD_B__', '__TST_B__'||gen_random_uuid()::text, 200, 100, true) RETURNING id INTO v_prod_b;
    INSERT INTO public.product_variants(account_id, product_id, sku, attributes, is_active)
    VALUES (v_account, v_prod_b, '__TST_B_M__'||gen_random_uuid()::text, '{"size":"M"}'::jsonb, true) RETURNING id INTO v_var_b;

    INSERT INTO public.inventory_movements(account_id, store_id, product_id, variant_id, type, qty, created_by, ref_table)
    VALUES (v_account, v_store, v_prod_a, NULL, 'adjustment', 10, v_user, '__test__'),
           (v_account, v_store, v_prod_b, v_var_b, 'adjustment', 10, v_user, '__test__');

    SELECT COALESCE(qty,0) INTO v_qty_a_before FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    SELECT COALESCE(qty,0) INTO v_qty_b_before FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_b AND variant_id=v_var_b;

    INSERT INTO public.sales(account_id, store_id, status, total, subtotal, discount, freight, delivery_fee, assembly_fee, source, payment_on_delivery, down_payment, remaining_balance)
    VALUES (v_account, v_store, 'paid', 500, 500, 0, 0, 0, 0, 'pos', false, 0, 0) RETURNING id INTO v_sale;

    INSERT INTO public.sale_items(account_id, sale_id, product_id, variant_id, qty, unit_price, total)
    VALUES (v_account, v_sale, v_prod_a, NULL, 3, 100, 300),
           (v_account, v_sale, v_prod_b, v_var_b, 2, 100, 200);

    PERFORM public.sales_status_inventory_apply(v_sale);

    SELECT COALESCE(qty,0) INTO v_qty_a_after_sale FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    SELECT COALESCE(qty,0) INTO v_qty_b_after_sale FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_b AND variant_id=v_var_b;

    RETURN QUERY SELECT 'stock_deduct_null_variant'::text, (v_qty_a_after_sale = v_qty_a_before - 3),
      format('before=%s after=%s', v_qty_a_before, v_qty_a_after_sale);
    RETURN QUERY SELECT 'stock_deduct_with_variant'::text, (v_qty_b_after_sale = v_qty_b_before - 2),
      format('before=%s after=%s', v_qty_b_before, v_qty_b_after_sale);

    PERFORM public.cancel_sale(v_sale, 'test cancellation'::text);

    SELECT COALESCE(qty,0) INTO v_qty_a_after_cancel FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    SELECT COALESCE(qty,0) INTO v_qty_b_after_cancel FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_b AND variant_id=v_var_b;

    RETURN QUERY SELECT 'stock_restore_null_variant_after_cancel'::text, (v_qty_a_after_cancel = v_qty_a_before),
      format('expected=%s got=%s', v_qty_a_before, v_qty_a_after_cancel);
    RETURN QUERY SELECT 'stock_restore_with_variant_after_cancel'::text, (v_qty_b_after_cancel = v_qty_b_before),
      format('expected=%s got=%s', v_qty_b_before, v_qty_b_after_cancel);

    SELECT COUNT(*) INTO v_mov_count FROM public.inventory_movements WHERE ref_id = v_sale;
    RETURN QUERY SELECT 'movements_created_for_sale'::text, (v_mov_count >= 4), format('movements=%s', v_mov_count);

    BEGIN PERFORM public.cancel_sale(v_sale, 'second cancel'::text);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    SELECT COALESCE(qty,0) INTO v_qty_a_after_cancel FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    RETURN QUERY SELECT 'cancel_idempotent_null_variant'::text, (v_qty_a_after_cancel = v_qty_a_before),
      format('got=%s', v_qty_a_after_cancel);

    INSERT INTO public.sales(account_id, store_id, status, total, subtotal, discount, freight, delivery_fee, assembly_fee, source, payment_on_delivery, down_payment, remaining_balance)
    VALUES (v_account, v_store, 'crediario', 100, 100, 0, 0, 0, 0, 'pos', false, 0, 100) RETURNING id INTO v_sale;
    INSERT INTO public.sale_items(account_id, sale_id, product_id, variant_id, qty, unit_price, total)
    VALUES (v_account, v_sale, v_prod_a, NULL, 1, 100, 100);

    PERFORM public.sales_status_inventory_apply(v_sale);

    SELECT COALESCE(qty,0) INTO v_qty_a_after_sale FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    RETURN QUERY SELECT 'crediario_deducts_stock'::text, (v_qty_a_after_sale = v_qty_a_before - 1),
      format('expected=%s got=%s', v_qty_a_before - 1, v_qty_a_after_sale);

    PERFORM public.cancel_sale(v_sale, 'cancel crediario'::text);

    SELECT COALESCE(qty,0) INTO v_qty_a_after_cancel FROM public.inventory
      WHERE account_id=v_account AND store_id=v_store AND product_id=v_prod_a AND variant_id IS NULL;
    RETURN QUERY SELECT 'crediario_restores_stock_on_cancel'::text, (v_qty_a_after_cancel = v_qty_a_before),
      format('expected=%s got=%s', v_qty_a_before, v_qty_a_after_cancel);

    SELECT COUNT(*) INTO v_recv_open FROM public.accounts_receivable
      WHERE sale_id = v_sale AND status NOT IN ('cancelled','canceled','paid');
    RETURN QUERY SELECT 'receivables_cancelled_with_sale'::text, (v_recv_open = 0), format('open=%s', v_recv_open);

    RAISE EXCEPTION 'ROLLBACK_TEST_DATA';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_TEST_DATA' THEN
      RETURN QUERY SELECT 'unexpected_error'::text, false, SQLERRM;
    END IF;
  END;
END;
$$;