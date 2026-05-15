
CREATE TABLE public.product_expiration_dates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  batch_label text DEFAULT NULL,
  expiration_date date NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  fiscal_entry_id uuid REFERENCES public.fiscal_entries(id) ON DELETE SET NULL,
  notes text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_expiration_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view expiration dates"
ON public.product_expiration_dates FOR SELECT
USING (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage expiration dates"
ON public.product_expiration_dates FOR ALL
USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Sellers can insert expiration dates"
ON public.product_expiration_dates FOR INSERT
WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role, 'seller'::account_role]));

CREATE INDEX idx_product_expiration_dates_expiry ON public.product_expiration_dates (expiration_date);
CREATE INDEX idx_product_expiration_dates_product ON public.product_expiration_dates (product_id, store_id);
CREATE INDEX idx_product_expiration_dates_account ON public.product_expiration_dates (account_id);
