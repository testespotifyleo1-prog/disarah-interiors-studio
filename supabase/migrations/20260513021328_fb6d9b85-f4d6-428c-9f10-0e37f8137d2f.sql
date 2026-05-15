CREATE OR REPLACE FUNCTION public.admin_delete_account(_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _store_ids uuid[];
  _product_ids uuid[];
  _sale_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _store_ids FROM public.stores WHERE account_id = _account_id;
  SELECT array_agg(id) INTO _product_ids FROM public.products WHERE account_id = _account_id;
  SELECT array_agg(id) INTO _sale_ids FROM public.sales WHERE account_id = _account_id;

  -- Detach chat conversations early
  BEGIN UPDATE public.chat_conversations SET sale_id = NULL, customer_id = NULL WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Helper macro-like blocks: each table either by account_id or by FK collection
  -- Marketing / messaging / logs
  BEGIN DELETE FROM public.email_send_logs WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.email_campaigns WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.reactivation_log WHERE campaign_id IN (SELECT id FROM public.reactivation_campaigns WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.reactivation_campaigns WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.birthday_send_log WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.birthday_coupons WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.customer_ai_profiles WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Held sales / cash
  BEGIN DELETE FROM public.held_sales WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.ai_simulations WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.cash_movements WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.cash_registers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- AI credits
  BEGIN DELETE FROM public.ai_credit_transactions WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.ai_credit_purchases WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.ai_credit_balances WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Integrations / connectors / webhooks
  BEGIN DELETE FROM public.amazon_connections WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.magalu_connections WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.melhor_envio_connections WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.meli_orders WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.meli_product_links WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.meli_connections WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.shopee_orders WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.shopee_product_links WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.shopee_connections WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.uber_direct_connections WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.webhook_deliveries WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.webhook_endpoints WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.api_request_logs WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.api_keys WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.pix_payment_requests WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Picking
  BEGIN DELETE FROM public.picking_items WHERE picking_order_id IN (SELECT id FROM public.picking_orders WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.picking_orders WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Customer returns
  BEGIN DELETE FROM public.customer_returns WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Return notes / supplier returns / POs / quotes / transfers / fiscal entries
  BEGIN DELETE FROM public.return_note_items WHERE return_note_id IN (SELECT id FROM public.return_notes WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.return_notes WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.supplier_return_items WHERE supplier_return_id IN (SELECT id FROM public.supplier_returns WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.supplier_returns WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.purchase_order_items WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.purchase_orders WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.quotes WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.store_transfer_items WHERE transfer_id IN (SELECT id FROM public.store_transfers WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.store_transfers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.fiscal_entry_items WHERE fiscal_entry_id IN (SELECT id FROM public.fiscal_entries WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.fiscal_entries WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Sales chain
  BEGIN DELETE FROM public.commissions WHERE sale_id = ANY(_sale_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.commission_cycles WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.deliveries WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.assemblies WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.fiscal_documents WHERE sale_id = ANY(_sale_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.payments WHERE sale_id = ANY(_sale_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.sale_items WHERE sale_id = ANY(_sale_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.store_credit_movements WHERE store_credit_id IN (SELECT id FROM public.store_credits WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.store_credits WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.credit_override_requests WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.accounts_receivable WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.accounts_payable WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.sales WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Customers
  BEGIN DELETE FROM public.customers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Sales goals
  BEGIN DELETE FROM public.sales_goals WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Inventory + product children + products
  BEGIN DELETE FROM public.product_expiration_dates WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.product_price_tiers WHERE product_id = ANY(_product_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.product_presentations WHERE product_id = ANY(_product_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.product_variants WHERE product_id = ANY(_product_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.product_images WHERE product_id = ANY(_product_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.inventory WHERE store_id = ANY(_store_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.products WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.categories WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.suppliers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.drivers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.assemblers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Import jobs
  BEGIN DELETE FROM public.import_job_errors WHERE job_id IN (SELECT id FROM public.import_jobs WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.import_jobs WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Settings / fiscal config / ecommerce
  BEGIN DELETE FROM public.nfeio_settings WHERE store_id = ANY(_store_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.fiscal_settings WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.store_ecommerce_settings WHERE account_id = _account_id OR store_id = ANY(_store_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.ecommerce_settings WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.chatbot_settings WHERE account_id = _account_id OR store_id = ANY(_store_ids); EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Memberships and stores
  BEGIN DELETE FROM public.store_memberships WHERE store_id = ANY(_store_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.seller_commission_rules WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.commission_tiers WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.activity_logs WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.system_logs WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.chat_messages WHERE conversation_id IN (SELECT id FROM public.chat_conversations WHERE account_id = _account_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.chat_conversations WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.support_tickets WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.memberships WHERE account_id = _account_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Stores
  DELETE FROM public.stores WHERE account_id = _account_id;

  -- Finally the account
  DELETE FROM public.accounts WHERE id = _account_id;
END;
$function$;