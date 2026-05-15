
-- Suppliers table (fornecedores per tenant)
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  name TEXT NOT NULL,
  trade_name TEXT,
  email TEXT,
  phone TEXT,
  address_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint per tenant
CREATE UNIQUE INDEX suppliers_account_cnpj_unique ON public.suppliers(account_id, cnpj);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage suppliers" ON public.suppliers
  FOR ALL USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Users can view suppliers" ON public.suppliers
  FOR SELECT USING (account_id = ANY(get_user_account_ids(auth.uid())));

-- Fiscal entries table
CREATE TABLE public.fiscal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  access_key TEXT,
  nfe_number TEXT,
  nfe_series TEXT,
  issue_date DATE,
  total_products NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_freight NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_nfe NUMERIC(12,2) NOT NULL DEFAULT 0,
  xml_path TEXT,
  pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  canceled_at TIMESTAMPTZ,
  canceled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.fiscal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fiscal entries" ON public.fiscal_entries
  FOR ALL USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Users can view fiscal entries" ON public.fiscal_entries
  FOR SELECT USING (account_id = ANY(get_user_account_ids(auth.uid())));

-- Fiscal entry items
CREATE TABLE public.fiscal_entry_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_entry_id UUID NOT NULL REFERENCES public.fiscal_entries(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  xml_code TEXT,
  description TEXT NOT NULL,
  ncm TEXT,
  cfop TEXT,
  unit TEXT NOT NULL DEFAULT 'UN',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_price NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_line NUMERIC(12,2) NOT NULL DEFAULT 0,
  matched BOOLEAN NOT NULL DEFAULT false,
  created_product BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.fiscal_entry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fiscal entry items" ON public.fiscal_entry_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.fiscal_entries fe
    WHERE fe.id = fiscal_entry_items.fiscal_entry_id
    AND has_account_role(auth.uid(), fe.account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])
  ));

CREATE POLICY "Users can view fiscal entry items" ON public.fiscal_entry_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.fiscal_entries fe
    WHERE fe.id = fiscal_entry_items.fiscal_entry_id
    AND fe.account_id = ANY(get_user_account_ids(auth.uid()))
  ));
