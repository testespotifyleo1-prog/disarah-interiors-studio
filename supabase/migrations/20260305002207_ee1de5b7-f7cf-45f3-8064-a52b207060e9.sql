
-- Credit override requests for crediário
CREATE TABLE public.credit_override_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id),
  sale_id uuid REFERENCES public.sales(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  current_limit numeric NOT NULL DEFAULT 0,
  used_balance numeric NOT NULL DEFAULT 0,
  sale_amount numeric NOT NULL DEFAULT 0,
  excess_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  denied_by uuid,
  denied_at timestamptz,
  authorization_type text,
  authorized_amount numeric,
  deny_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_override_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit requests" ON public.credit_override_requests
FOR SELECT USING (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Members can create credit requests" ON public.credit_override_requests
FOR INSERT WITH CHECK (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Owners can update credit requests" ON public.credit_override_requests
FOR UPDATE USING (
  has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role])
);

-- Commission cycles
CREATE TABLE public.commission_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_commission numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view commission cycles" ON public.commission_cycles
FOR SELECT USING (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage commission cycles" ON public.commission_cycles
FOR ALL USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]));

-- Owner PIN on accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS owner_pin text;
