
-- Cash movements (sangria/reforço)
CREATE TABLE public.cash_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  type text NOT NULL CHECK (type IN ('sangria', 'reforco')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  reason text,
  created_by uuid NOT NULL,
  authorized_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view cash movements"
  ON public.cash_movements FOR SELECT
  USING (account_id = ANY (get_user_account_ids(auth.uid())));

CREATE POLICY "Members can insert cash movements"
  ON public.cash_movements FOR INSERT
  WITH CHECK (account_id = ANY (get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage cash movements"
  ON public.cash_movements FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE INDEX idx_cash_movements_register ON public.cash_movements(cash_register_id);
CREATE INDEX idx_cash_movements_store ON public.cash_movements(store_id);

-- Store credits (créditos de devolução)
CREATE TABLE public.store_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  sale_id uuid REFERENCES public.sales(id),
  original_amount numeric(12,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(12,2) NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'devolução',
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'canceled')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_in_sale_id uuid REFERENCES public.sales(id)
);

ALTER TABLE public.store_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view store credits"
  ON public.store_credits FOR SELECT
  USING (account_id = ANY (get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage store credits"
  ON public.store_credits FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Members can insert store credits"
  ON public.store_credits FOR INSERT
  WITH CHECK (account_id = ANY (get_user_account_ids(auth.uid())));

CREATE INDEX idx_store_credits_customer ON public.store_credits(customer_id);
CREATE INDEX idx_store_credits_sale ON public.store_credits(sale_id);
CREATE INDEX idx_store_credits_status ON public.store_credits(status);
