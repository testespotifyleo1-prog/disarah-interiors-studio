
-- Cash registers for PDV Rápido
CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_amount numeric(12,2) NOT NULL DEFAULT 0,
  closed_by uuid,
  closed_at timestamptz,
  closing_amount numeric(12,2),
  total_sales numeric(12,2) DEFAULT 0,
  total_cash numeric(12,2) DEFAULT 0,
  total_card numeric(12,2) DEFAULT 0,
  total_pix numeric(12,2) DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'open'
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage cash registers" ON public.cash_registers
  FOR ALL TO authenticated
  USING (account_id = ANY(get_user_account_ids(auth.uid())))
  WITH CHECK (account_id = ANY(get_user_account_ids(auth.uid())));

-- Ecommerce settings per store
CREATE TABLE public.store_ecommerce_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) UNIQUE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  slug text UNIQUE NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  store_name text,
  banner_text text DEFAULT 'Bem-vindo à nossa loja!',
  description text,
  whatsapp_number text,
  primary_color text DEFAULT '#1e40af',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_ecommerce_settings ENABLE ROW LEVEL SECURITY;

-- Admins manage their own settings
CREATE POLICY "Admins can manage ecommerce settings" ON public.store_ecommerce_settings
  FOR ALL TO authenticated
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]))
  WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]));

-- Anyone can read enabled stores (for public storefront)
CREATE POLICY "Public can view enabled ecommerce" ON public.store_ecommerce_settings
  FOR SELECT TO anon
  USING (is_enabled = true);
