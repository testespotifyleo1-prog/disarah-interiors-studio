
DO $$
DECLARE
  v_account uuid := '2480b8ae-c3a4-4a39-ad76-e6b41013f25e';
  v_store   uuid := '485b5496-f118-45f9-b4f7-7ba278eba501';
  v_seller  uuid := 'a77d53c8-87f9-498b-b0e3-9da6f975422e';
  v_product uuid := '71c3a557-8d57-4ee4-a850-fb2bc3c5754a';
  v_conn    uuid;
  v_sale1   uuid;
  v_sale2   uuid;
  v_stock_before numeric;
  v_stock_after  numeric;
  v_sale_status  text;
  v_pay_count    int;
  v_results      text := '';
BEGIN
  -- Estoque inicial
  SELECT qty_on_hand INTO v_stock_before FROM inventory WHERE store_id=v_store AND product_id=v_product;
  v_results := v_results || '[INI] Estoque inicial: ' || v_stock_before || E'\n';

  -- 1) Conexão MP fake
  INSERT INTO mp_connections (store_id, account_id, status, public_key, access_token, mp_user_id, credit_fee_percent, debit_fee_percent)
  VALUES (v_store, v_account, 'connected', 'TEST-PUB', 'TEST-TOK', '999999', 4.5, 2.0)
  ON CONFLICT (store_id) DO UPDATE SET status='connected', credit_fee_percent=4.5, debit_fee_percent=2.0
  RETURNING id INTO v_conn;
  v_results := v_results || '[1] Conexão MP criada: ' || v_conn || E'\n';

  -- ============ FLUXO PDV (PIX) ============
  INSERT INTO sales (account_id, store_id, seller_user_id, status, subtotal, total, source)
  VALUES (v_account, v_store, v_seller, 'open', 4.99, 4.99, 'pdv')
  RETURNING id INTO v_sale1;
  INSERT INTO sale_items (sale_id, product_id, qty, unit_price, total_line) VALUES (v_sale1, v_product, 2, 4.99, 9.98);
  v_results := v_results || '[2] Venda PDV criada (open): ' || v_sale1 || E'\n';

  -- Simula webhook MP aprovando PIX
  INSERT INTO mp_payments (account_id, store_id, connection_id, sale_id, external_reference, source, method, amount, status, mp_payment_id)
  VALUES (v_account, v_store, v_conn, v_sale1, 'test-pdv-pix-001', 'pdv', 'pix', 9.98, 'approved', 'TEST-MP-001');
  v_results := v_results || '[3] mp_payments inserido com status=approved' || E'\n';

  -- Verificações
  SELECT status INTO v_sale_status FROM sales WHERE id=v_sale1;
  SELECT COUNT(*) INTO v_pay_count FROM payments WHERE sale_id=v_sale1;
  SELECT qty_on_hand INTO v_stock_after FROM inventory WHERE store_id=v_store AND product_id=v_product;
  v_results := v_results || '    -> sales.status = ' || v_sale_status || ' (esperado: paid)' || E'\n';
  v_results := v_results || '    -> payments rows = ' || v_pay_count || ' (esperado: 1)' || E'\n';
  v_results := v_results || '    -> estoque = ' || v_stock_after || ' (esperado: ' || (v_stock_before-2) || ')' || E'\n';

  -- ============ IDEMPOTÊNCIA: webhook duplicado ============
  UPDATE mp_payments SET raw_payload='{"dup":true}'::jsonb WHERE external_reference='test-pdv-pix-001';
  -- Também simula segundo INSERT (cenário webhook reentrante) com mesmo mp_payment_id
  BEGIN
    INSERT INTO mp_payments (account_id, store_id, connection_id, sale_id, external_reference, source, method, amount, status, mp_payment_id)
    VALUES (v_account, v_store, v_conn, v_sale1, 'test-pdv-pix-001-dup', 'pdv', 'pix', 9.98, 'approved', 'TEST-MP-001');
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || '    -> 2º insert duplicado bloqueado: ' || SQLERRM || E'\n';
  END;
  SELECT COUNT(*) INTO v_pay_count FROM payments WHERE sale_id=v_sale1;
  SELECT qty_on_hand INTO v_stock_after FROM inventory WHERE store_id=v_store AND product_id=v_product;
  v_results := v_results || '[4] IDEMPOTÊNCIA: payments=' || v_pay_count || ' (deve seguir 1), estoque=' || v_stock_after || ' (não duplicado)' || E'\n';

  -- ============ FLUXO E-COMMERCE (Crédito 3x) ============
  INSERT INTO sales (account_id, store_id, seller_user_id, status, subtotal, total, source)
  VALUES (v_account, v_store, v_seller, 'open', 4.99, 14.97, 'ecommerce')
  RETURNING id INTO v_sale2;
  INSERT INTO sale_items (sale_id, product_id, qty, unit_price, total_line) VALUES (v_sale2, v_product, 3, 4.99, 14.97);
  v_results := v_results || '[5] Venda E-COMMERCE criada (open): ' || v_sale2 || E'\n';

  INSERT INTO mp_payments (account_id, store_id, connection_id, sale_id, external_reference, source, method, amount, status, mp_payment_id, installments, card_brand)
  VALUES (v_account, v_store, v_conn, v_sale2, 'test-ec-card-001', 'ecommerce', 'credit_card', 14.97, 'approved', 'TEST-MP-002', 3, 'visa');

  SELECT status INTO v_sale_status FROM sales WHERE id=v_sale2;
  SELECT qty_on_hand INTO v_stock_after FROM inventory WHERE store_id=v_store AND product_id=v_product;
  v_results := v_results || '    -> sales.status = ' || v_sale_status || ' (esperado: paid)' || E'\n';
  v_results := v_results || '    -> estoque final = ' || v_stock_after || ' (esperado: ' || (v_stock_before-5) || ')' || E'\n';

  -- Verifica payment de cartão
  PERFORM 1 FROM payments WHERE sale_id=v_sale2 AND method='card' AND card_type='credit' AND installments=3 AND card_fee_percent=4.5;
  IF FOUND THEN
    v_results := v_results || '[6] payment cartão OK (3x, taxa 4,5% aplicada)' || E'\n';
  ELSE
    v_results := v_results || '[6] !!! payment cartão NÃO criado conforme esperado !!!' || E'\n';
  END IF;

  -- ============ CLEANUP ============
  DELETE FROM payments WHERE sale_id IN (v_sale1, v_sale2);
  DELETE FROM commissions WHERE sale_id IN (v_sale1, v_sale2);
  DELETE FROM deliveries WHERE sale_id IN (v_sale1, v_sale2);
  DELETE FROM mp_payments WHERE external_reference LIKE 'test-%';
  DELETE FROM sale_items WHERE sale_id IN (v_sale1, v_sale2);
  DELETE FROM sales WHERE id IN (v_sale1, v_sale2);
  -- Restaura estoque
  UPDATE inventory SET qty_on_hand = v_stock_before WHERE store_id=v_store AND product_id=v_product;
  -- Remove conexão fake
  DELETE FROM mp_connections WHERE id=v_conn AND public_key='TEST-PUB';
  v_results := v_results || '[FIM] Cleanup OK. Estoque restaurado para ' || v_stock_before || E'\n';

  RAISE NOTICE E'\n========== RESULTADO TESTE MP ==========\n%==========================================', v_results;
END $$;
