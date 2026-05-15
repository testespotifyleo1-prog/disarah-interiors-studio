CREATE OR REPLACE FUNCTION public.reset_account_data(_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_account_role(auth.uid(), _account_id, ARRAY['owner'::account_role]) THEN
    RAISE EXCEPTION 'Apenas o proprietário pode resetar os dados';
  END IF;

  -- Return note items + return notes (depend on sales)
  DELETE FROM public.return_note_items WHERE return_note_id IN (SELECT id FROM public.return_notes WHERE account_id = _account_id);
  DELETE FROM public.return_notes WHERE account_id = _account_id;

  -- Fiscal documents (depend on sales)
  DELETE FROM public.fiscal_documents WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id);

  -- Assemblies / commissions / deliveries / payments (depend on sales)
  DELETE FROM public.assemblies WHERE account_id = _account_id;
  DELETE FROM public.commissions WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  DELETE FROM public.commission_cycles WHERE account_id = _account_id;
  DELETE FROM public.deliveries WHERE account_id = _account_id;
  DELETE FROM public.payments WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);

  -- Receivables / payables / credit overrides
  DELETE FROM public.accounts_receivable WHERE account_id = _account_id;
  DELETE FROM public.accounts_payable WHERE account_id = _account_id;
  DELETE FROM public.credit_override_requests WHERE account_id = _account_id;

  -- Store credits (FK to sales) — must clean BEFORE deleting sales
  DELETE FROM public.store_credits WHERE account_id = _account_id;

  -- Quotes (FK converted_sale_id to sales)
  BEGIN
    UPDATE public.quotes SET converted_sale_id = NULL WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Chat conversations (FK to sales)
  BEGIN
    UPDATE public.chat_conversations SET sale_id = NULL WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Marketplace orders (ON DELETE SET NULL but be explicit)
  BEGIN
    UPDATE public.shopee_orders SET sale_id = NULL WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    UPDATE public.meli_orders SET sale_id = NULL WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Email logs
  BEGIN
    DELETE FROM public.email_send_logs WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Sale items + Sales
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  DELETE FROM public.sales WHERE account_id = _account_id;

  -- Quotes themselves
  BEGIN
    DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE account_id = _account_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    DELETE FROM public.quotes WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Fiscal entries
  DELETE FROM public.fiscal_entry_items WHERE fiscal_entry_id IN (SELECT id FROM public.fiscal_entries WHERE account_id = _account_id);
  DELETE FROM public.fiscal_entries WHERE account_id = _account_id;

  -- Imports
  DELETE FROM public.import_job_errors WHERE job_id IN (SELECT id FROM public.import_jobs WHERE account_id = _account_id);
  DELETE FROM public.import_jobs WHERE account_id = _account_id;

  -- Inventory
  DELETE FROM public.inventory WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id);

  -- Suppliers / Customers / Products
  DELETE FROM public.suppliers WHERE account_id = _account_id;
  DELETE FROM public.customers WHERE account_id = _account_id;
  DELETE FROM public.products WHERE account_id = _account_id;

  -- Assemblers & Drivers
  DELETE FROM public.assemblers WHERE account_id = _account_id;
  DELETE FROM public.drivers WHERE account_id = _account_id;

  -- Activity logs
  DELETE FROM public.activity_logs WHERE account_id = _account_id;
END;
$function$;