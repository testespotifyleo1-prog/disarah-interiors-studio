
-- 1) Payment method: add 'crediario' to payment_method enum
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'crediario';

-- 2) Customer credit fields
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_authorized boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric(12,2) NOT NULL DEFAULT 0;

-- 3) Accounts Payable table
CREATE TABLE IF NOT EXISTS public.accounts_payable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  payment_method text,
  supplier_name text,
  notes text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage accounts_payable"
  ON public.accounts_payable FOR ALL TO authenticated
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Users can view accounts_payable"
  ON public.accounts_payable FOR SELECT TO authenticated
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

-- 4) Accounts Receivable table
CREATE TABLE IF NOT EXISTS public.accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'venda',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  installment_number integer DEFAULT 1,
  total_installments integer DEFAULT 1,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage accounts_receivable"
  ON public.accounts_receivable FOR ALL TO authenticated
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Users can view accounts_receivable"
  ON public.accounts_receivable FOR SELECT TO authenticated
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

-- 5) Store PIX key
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS pix_key_type text;
