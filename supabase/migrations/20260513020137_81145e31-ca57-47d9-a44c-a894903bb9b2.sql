CREATE OR REPLACE FUNCTION public.admin_delete_account(_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- This function is intended to be called only by the delete-account edge function
  -- which validates super_admin status via service role before invocation.

  -- Reuse the existing reset routine to clear operational data, then drop structure.
  -- We bypass the auth.uid() check by inlining the safe deletes here.

  -- Detach chat conversations
  BEGIN UPDATE public.chat_conversations SET sale_id = NULL, customer_id = NULL WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Operational logs / queues
  BEGIN DELETE FROM public.email_send_logs WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.birthday_send_log WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.birthday_coupons WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.customer_ai_profiles WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.held_sales WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.ai_simulations WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.cash_movements WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.cash_registers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Return notes
  BEGIN
    DELETE FROM public.return_note_items WHERE return_note_id IN (SELECT id FROM public.return_notes WHERE account_id = _account_id);
    DELETE FROM public.return_notes WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Supplier returns
  BEGIN
    DELETE FROM public.supplier_return_items WHERE supplier_return_id IN (SELECT id FROM public.supplier_returns WHERE account_id = _account_id);
    DELETE FROM public.supplier_returns WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Purchase orders
  BEGIN
    DELETE FROM public.purchase_order_items WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE account_id = _account_id);
    DELETE FROM public.purchase_orders WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Quotes
  BEGIN
    DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE account_id = _account_id);
    DELETE FROM public.quotes WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Store transfers
  BEGIN
    DELETE FROM public.store_transfer_items WHERE transfer_id IN (SELECT id FROM public.store_transfers WHERE account_id = _account_id);
    DELETE FROM public.store_transfers WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Fiscal entries / received NFes
  BEGIN
    DELETE FROM public.fiscal_entry_items WHERE fiscal_entry_id IN (SELECT id FROM public.fiscal_entries WHERE account_id = _account_id);
    DELETE FROM public.fiscal_entries WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Sales chain
  BEGIN DELETE FROM public.commissions WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.commission_cycles WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.deliveries WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.assemblies WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.fiscal_documents WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.payments WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.store_credit_movements WHERE store_credit_id IN (SELECT id FROM public.store_credits WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.store_credits WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.credit_override_requests WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.accounts_receivable WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.accounts_payable WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.sales WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Customers
  BEGIN DELETE FROM public.customers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Inventory + products
  BEGIN DELETE FROM public.product_expiration_dates WHERE product_id IN (SELECT id FROM public.products WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.product_price_tiers WHERE product_id IN (SELECT id FROM public.products WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.product_presentations WHERE product_id IN (SELECT id FROM public.products WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.product_variants WHERE product_id IN (SELECT id FROM public.products WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.product_images WHERE product_id IN (SELECT id FROM public.products WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.inventory WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.products WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.categories WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.suppliers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.drivers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.assemblers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Settings / fiscal config
  BEGIN DELETE FROM public.nfeio_settings WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.fiscal_settings WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.ecommerce_settings WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Memberships and stores
  BEGIN DELETE FROM public.store_memberships WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.seller_commission_rules WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.commission_tiers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.activity_logs WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.system_logs WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.chat_messages WHERE conversation_id IN (SELECT id FROM public.chat_conversations WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.chat_conversations WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.api_keys WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.api_request_logs WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.support_tickets WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Memberships (must come before stores+account)
  BEGIN DELETE FROM public.memberships WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Stores
  BEGIN DELETE FROM public.stores WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Finally the account
  DELETE FROM public.accounts WHERE id = _account_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_account(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_account(uuid) FROM anon;