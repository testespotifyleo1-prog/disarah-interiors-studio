
-- Indexes for sale_items (critical for loading sale details and closing sales)
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items (product_id);

-- Indexes for payments (critical for sale closing and financial queries)
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments (sale_id);

-- Indexes for sales (critical for listing, filtering, and lookups)
CREATE INDEX IF NOT EXISTS idx_sales_account_id ON public.sales (account_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON public.sales (store_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller_user_id ON public.sales (seller_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_account_status ON public.sales (account_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_account_order_number ON public.sales (account_id, order_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales (created_at DESC);

-- Indexes for commissions (triggered on sale paid)
CREATE INDEX IF NOT EXISTS idx_commissions_sale_id ON public.commissions (sale_id);
CREATE INDEX IF NOT EXISTS idx_commissions_seller ON public.commissions (seller_user_id);

-- Indexes for deliveries (created on sale paid)
CREATE INDEX IF NOT EXISTS idx_deliveries_sale_id ON public.deliveries (sale_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_account_store ON public.deliveries (account_id, store_id);

-- Indexes for accounts_receivable (crediário flow)
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_sale_id ON public.accounts_receivable (sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_customer ON public.accounts_receivable (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_account ON public.accounts_receivable (account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_status ON public.accounts_receivable (account_id, status);

-- Indexes for accounts_payable
CREATE INDEX IF NOT EXISTS idx_accounts_payable_account ON public.accounts_payable (account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON public.accounts_payable (account_id, status);

-- Indexes for fiscal_documents (NFC-e lookup)
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_sale_id ON public.fiscal_documents (sale_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_store_id ON public.fiscal_documents (store_id);

-- Indexes for cash_registers
CREATE INDEX IF NOT EXISTS idx_cash_registers_store_status ON public.cash_registers (store_id, status);
