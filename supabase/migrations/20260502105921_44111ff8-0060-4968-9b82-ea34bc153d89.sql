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

  -- Desvincula conversas preservadas antes de remover clientes/vendas
  BEGIN
    UPDATE public.chat_conversations
      SET sale_id = NULL,
          customer_id = NULL
    WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Remove registros operacionais ligados a clientes que podem bloquear a exclusão
  BEGIN
    DELETE FROM public.email_send_logs WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM public.birthday_send_log WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM public.birthday_coupons WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM public.customer_ai_profiles WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM public.held_sales WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM public.ai_simulations WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Caixas e movimentos operacionais da conta
  BEGIN
    DELETE FROM public.cash_movements WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM public.cash_registers WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Return notes + items dependem de vendas/clientes/produtos
  DELETE FROM public.return_note_items
  WHERE return_note_id IN (SELECT id FROM public.return_notes WHERE account_id = _account_id);
  DELETE FROM public.return_notes WHERE account_id = _account_id;

  -- Devoluções de fornecedor dependem de produtos/notas fiscais
  BEGIN
    DELETE FROM public.supplier_return_items
    WHERE supplier_return_id IN (SELECT id FROM public.supplier_returns WHERE account_id = _account_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM public.supplier_returns WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Pedidos de compra dependem de fornecedores/produtos
  BEGIN
    DELETE FROM public.purchase_order_items
    WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE account_id = _account_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM public.purchase_orders WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Transferências dependem de produtos
  BEGIN
    DELETE FROM public.store_transfer_items
    WHERE transfer_id IN (SELECT id FROM public.store_transfers WHERE account_id = _account_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM public.store_transfers WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Fiscal documents dependem de vendas
  DELETE FROM public.fiscal_documents WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id);

  -- Assemblies / commissions / deliveries / payments dependem de vendas
  DELETE FROM public.assemblies WHERE account_id = _account_id;
  DELETE FROM public.commissions WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  DELETE FROM public.commission_cycles WHERE account_id = _account_id;
  DELETE FROM public.deliveries WHERE account_id = _account_id;
  DELETE FROM public.payments WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);

  -- Receivables / payables / credit overrides
  DELETE FROM public.accounts_receivable WHERE account_id = _account_id;
  DELETE FROM public.accounts_payable WHERE account_id = _account_id;
  DELETE FROM public.credit_override_requests WHERE account_id = _account_id;

  -- Pagamentos externos / créditos vinculados a vendas
  BEGIN
    DELETE FROM public.mp_payments WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM public.store_credits WHERE account_id = _account_id;

  -- Quotes dependem de vendas/produtos/clientes
  BEGIN
    UPDATE public.quotes SET converted_sale_id = NULL WHERE account_id = _account_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Marketplace orders podem referenciar vendas
  BEGIN
    UPDATE public.shopee_orders SET sale_id = NULL WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    UPDATE public.meli_orders SET sale_id = NULL WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
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

  -- Lotes/validade referenciam notas fiscais e produtos
  BEGIN
    DELETE FROM public.product_expiration_dates WHERE account_id = _account_id;
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

-- Garante que futuras exclusões de clientes nunca travem por conversas preservadas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_conversations_customer_id_fkey'
      AND conrelid = 'public.chat_conversations'::regclass
  ) THEN
    ALTER TABLE public.chat_conversations
      DROP CONSTRAINT chat_conversations_customer_id_fkey;
  END IF;

  ALTER TABLE public.chat_conversations
    ADD CONSTRAINT chat_conversations_customer_id_fkey
    FOREIGN KEY (customer_id)
    REFERENCES public.customers(id)
    ON DELETE SET NULL;
END $$;