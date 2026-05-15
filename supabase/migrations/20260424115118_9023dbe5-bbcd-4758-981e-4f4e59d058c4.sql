
DO $$
DECLARE
  v_account uuid := '2480b8ae-c3a4-4a39-ad76-e6b41013f25e';
  v_store   uuid := '485b5496-f118-45f9-b4f7-7ba278eba501';
  v_seller  uuid := 'a77d53c8-87f9-498b-b0e3-9da6f975422e';
  v_product uuid := '71c3a557-8d57-4ee4-a850-fb2bc3c5754a';
  v_conn    uuid;
  v_sale1   uuid;
  v_sale2   uuid;
BEGIN
  INSERT INTO mp_connections (store_id, account_id, status, public_key, access_token, mp_user_id, credit_fee_percent, debit_fee_percent)
  VALUES (v_store, v_account, 'connected', 'TEST-PUB-KEEP', 'TEST-TOK', '999999', 4.5, 2.0)
  ON CONFLICT (store_id) DO UPDATE SET status='connected', credit_fee_percent=4.5, debit_fee_percent=2.0
  RETURNING id INTO v_conn;

  -- PDV PIX
  INSERT INTO sales (account_id, store_id, seller_user_id, status, subtotal, total, source, notes)
  VALUES (v_account, v_store, v_seller, 'open', 4.99, 9.98, 'pdv', '__MP_TEST_KEEP__')
  RETURNING id INTO v_sale1;
  INSERT INTO sale_items (sale_id, product_id, qty, unit_price, total_line) VALUES (v_sale1, v_product, 2, 4.99, 9.98);
  INSERT INTO mp_payments (account_id, store_id, connection_id, sale_id, external_reference, source, method, amount, status, mp_payment_id)
  VALUES (v_account, v_store, v_conn, v_sale1, 'keep-pdv-pix', 'pdv', 'pix', 9.98, 'approved', 'TEST-KEEP-001');

  -- Simula webhook duplicado (mesmo mp_payment_id, novo registro mp_payments)
  BEGIN
    INSERT INTO mp_payments (account_id, store_id, connection_id, sale_id, external_reference, source, method, amount, status, mp_payment_id)
    VALUES (v_account, v_store, v_conn, v_sale1, 'keep-pdv-pix-dup', 'pdv', 'pix', 9.98, 'approved', 'TEST-KEEP-001');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- E-COMMERCE Crédito 3x
  INSERT INTO sales (account_id, store_id, seller_user_id, status, subtotal, total, source, notes)
  VALUES (v_account, v_store, v_seller, 'open', 4.99, 14.97, 'ecommerce', '__MP_TEST_KEEP__')
  RETURNING id INTO v_sale2;
  INSERT INTO sale_items (sale_id, product_id, qty, unit_price, total_line) VALUES (v_sale2, v_product, 3, 4.99, 14.97);
  INSERT INTO mp_payments (account_id, store_id, connection_id, sale_id, external_reference, source, method, amount, status, mp_payment_id, installments, card_brand)
  VALUES (v_account, v_store, v_conn, v_sale2, 'keep-ec-card', 'ecommerce', 'credit_card', 14.97, 'approved', 'TEST-KEEP-002', 3, 'visa');
END $$;
