
DO $$
DECLARE
  v_store uuid := '485b5496-f118-45f9-b4f7-7ba278eba501';
  v_product uuid := '71c3a557-8d57-4ee4-a850-fb2bc3c5754a';
  v_sale_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_sale_ids FROM sales WHERE notes='__MP_TEST_KEEP__';
  IF v_sale_ids IS NOT NULL THEN
    DELETE FROM payments WHERE sale_id = ANY(v_sale_ids);
    DELETE FROM commissions WHERE sale_id = ANY(v_sale_ids);
    DELETE FROM deliveries WHERE sale_id = ANY(v_sale_ids);
    DELETE FROM mp_payments WHERE sale_id = ANY(v_sale_ids);
    DELETE FROM sale_items WHERE sale_id = ANY(v_sale_ids);
    DELETE FROM sales WHERE id = ANY(v_sale_ids);
  END IF;
  -- Restaura estoque (estava 20, baixou 5)
  UPDATE inventory SET qty_on_hand = 20, updated_at = now()
   WHERE store_id = v_store AND product_id = v_product;
  -- Remove conexão MP fake (só se ainda for a fake)
  DELETE FROM mp_connections WHERE store_id = v_store AND public_key = 'TEST-PUB-KEEP';
END $$;
