
-- Table: supplier_returns
CREATE TABLE public.supplier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  fiscal_entry_id uuid NOT NULL REFERENCES public.fiscal_entries(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  status text NOT NULL DEFAULT 'draft',
  total_return numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  fiscal_document_id uuid REFERENCES public.fiscal_documents(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: supplier_return_items
CREATE TABLE public.supplier_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_return_id uuid NOT NULL REFERENCES public.supplier_returns(id) ON DELETE CASCADE,
  fiscal_entry_item_id uuid REFERENCES public.fiscal_entry_items(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_line numeric NOT NULL DEFAULT 0
);

-- RLS on supplier_returns
ALTER TABLE public.supplier_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage supplier returns"
  ON public.supplier_returns FOR ALL
  TO authenticated
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Users can view supplier returns"
  ON public.supplier_returns FOR SELECT
  TO authenticated
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

-- RLS on supplier_return_items
ALTER TABLE public.supplier_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage supplier return items"
  ON public.supplier_return_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_returns sr
    WHERE sr.id = supplier_return_items.supplier_return_id
    AND has_account_role(auth.uid(), sr.account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])
  ));

CREATE POLICY "Users can view supplier return items"
  ON public.supplier_return_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_returns sr
    WHERE sr.id = supplier_return_items.supplier_return_id
    AND sr.account_id = ANY(get_user_account_ids(auth.uid()))
  ));
