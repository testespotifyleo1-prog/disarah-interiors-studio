
CREATE OR REPLACE FUNCTION public.reset_account_data(_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only owners can reset
  IF NOT has_account_role(auth.uid(), _account_id, ARRAY['owner'::account_role]) THEN
    RAISE EXCEPTION 'Apenas o proprietário pode resetar os dados';
  END IF;

  -- Delete in correct order to respect FK constraints
  -- 1. Return note items (references sale_items and return_notes)
  DELETE FROM public.return_note_items WHERE return_note_id IN (SELECT id FROM public.return_notes WHERE account_id = _account_id);
  -- 2. Fiscal documents referencing return_notes
  DELETE FROM public.fiscal_documents WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id);
  -- 3. Return notes (references sales)
  DELETE FROM public.return_notes WHERE account_id = _account_id;
  -- 4. Assemblies
  DELETE FROM public.assemblies WHERE account_id = _account_id;
  -- 5. Commissions
  DELETE FROM public.commissions WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  -- 6. Commission cycles
  DELETE FROM public.commission_cycles WHERE account_id = _account_id;
  -- 7. Deliveries
  DELETE FROM public.deliveries WHERE account_id = _account_id;
  -- 8. Payments
  DELETE FROM public.payments WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  -- 9. Accounts receivable
  DELETE FROM public.accounts_receivable WHERE account_id = _account_id;
  -- 10. Accounts payable
  DELETE FROM public.accounts_payable WHERE account_id = _account_id;
  -- 11. Credit override requests
  DELETE FROM public.credit_override_requests WHERE account_id = _account_id;
  -- 12. Sale items
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  -- 13. Sales
  DELETE FROM public.sales WHERE account_id = _account_id;
  -- 14. Fiscal entry items
  DELETE FROM public.fiscal_entry_items WHERE fiscal_entry_id IN (SELECT id FROM public.fiscal_entries WHERE account_id = _account_id);
  -- 15. Fiscal entries
  DELETE FROM public.fiscal_entries WHERE account_id = _account_id;
  -- 16. Import jobs
  DELETE FROM public.import_job_errors WHERE job_id IN (SELECT id FROM public.import_jobs WHERE account_id = _account_id);
  DELETE FROM public.import_jobs WHERE account_id = _account_id;
  -- 17. Inventory
  DELETE FROM public.inventory WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id);
  -- 18. Suppliers
  DELETE FROM public.suppliers WHERE account_id = _account_id;
  -- 19. Customers
  DELETE FROM public.customers WHERE account_id = _account_id;
  -- 20. Products
  DELETE FROM public.products WHERE account_id = _account_id;
  -- 21. Assemblers & Drivers
  DELETE FROM public.assemblers WHERE account_id = _account_id;
  DELETE FROM public.drivers WHERE account_id = _account_id;
  -- 22. Activity logs
  DELETE FROM public.activity_logs WHERE account_id = _account_id;
END;
$function$;
