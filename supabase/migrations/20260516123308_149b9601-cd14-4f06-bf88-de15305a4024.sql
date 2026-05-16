CREATE OR REPLACE FUNCTION public.run_inventory_tests()
RETURNS TABLE(test_name text, passed boolean, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account uuid := public.current_account_id();
  v_store uuid := public.current_store_id();
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
  VALUES (v_sale, v_account, v_store, NULL, 'open', 20, 0, 20);
  INSERT INTO public.sale_items (account_id, sale_id, product_id, variant_id, qty, unit_price, unit_cost, total_line)
  VALUES (v_account, v_sale, v_product, NULL, 2, 10, 5, 20);

  UPDATE public.sales SET status = 'paid' WHERE id = v_sale;

  SELECT qty INTO v_qty FROM public.inventory
  WHERE store_id = v_store AND product_id = v_product AND variant_id IS NULL;
  test_name := 'venda de 2 desconta do saldo manual 5';
  passed := v_qty = 3;
  details := 'saldo=' || COALESCE(v_qty::text, 'null');
  RETURN NEXT;

  PERFORM public.cancel_sale(_sale_id => v_sale, _reason => 'teste estorno', _user_id => NULL);

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

REVOKE EXECUTE ON FUNCTION public.reconcile_inventory_item(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_inventory(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inventory_manual_adjustment_to_movement() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.run_inventory_tests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_inventory_item(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_inventory(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_inventory_tests() TO authenticated;