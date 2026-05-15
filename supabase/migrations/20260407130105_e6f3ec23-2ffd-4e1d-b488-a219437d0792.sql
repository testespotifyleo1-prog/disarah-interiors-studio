
CREATE TABLE public.held_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL,
  cart_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.held_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view held sales"
ON public.held_sales FOR SELECT
USING (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Members can insert held sales"
ON public.held_sales FOR INSERT
WITH CHECK (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage held sales"
ON public.held_sales FOR ALL
USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Sellers can manage own held sales"
ON public.held_sales FOR DELETE
USING (seller_user_id = auth.uid() AND account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Sellers can update own held sales"
ON public.held_sales FOR UPDATE
USING (seller_user_id = auth.uid() AND account_id = ANY(get_user_account_ids(auth.uid())));

CREATE INDEX idx_held_sales_store_seller ON public.held_sales(store_id, seller_user_id);
