
-- Plans table
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  max_users integer NOT NULL DEFAULT 3,
  max_stores integer NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.plans FOR SELECT USING (true);

CREATE POLICY "Super admins can manage plans"
  ON public.plans FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Add plan_id to accounts (nullable = legacy/full access)
ALTER TABLE public.accounts ADD COLUMN plan_id uuid REFERENCES public.plans(id);

-- Insert 4 default plans
INSERT INTO public.plans (name, slug, price, description, max_users, max_stores, sort_order, features) VALUES
(
  'Typos Start', 'start', 199.00,
  'Ideal para quem está começando no varejo',
  3, 1, 1,
  '["pdv","pdv_rapido","products","categories","product_groups","variants","inventory","customers","suppliers","sales","cash_register","finance_basic","crediario","fiscal_basic","reports_basic","sellers"]'::jsonb
),
(
  'Typos Pro', 'pro', 349.00,
  'Para operações de varejo mais robustas',
  5, 2, 2,
  '["pdv","pdv_rapido","products","categories","product_groups","variants","inventory","customers","suppliers","sales","cash_register","finance_basic","crediario","fiscal_basic","reports_basic","sellers","quotes","purchase_orders","replenishment","store_transfers","commissions","returns","reports_advanced","fiscal_entries","import_export","labels"]'::jsonb
),
(
  'Typos Multi', 'multi', 597.00,
  'Gestão completa para múltiplas lojas',
  10, 5, 3,
  '["pdv","pdv_rapido","products","categories","product_groups","variants","inventory","customers","suppliers","sales","cash_register","finance_basic","crediario","fiscal_basic","reports_basic","sellers","quotes","purchase_orders","replenishment","store_transfers","commissions","returns","reports_advanced","fiscal_entries","import_export","labels","multi_store","priority_support"]'::jsonb
),
(
  'Typos Prime', 'prime', 897.00,
  'Operação completa com todos os recursos do sistema',
  30, 10, 4,
  '["pdv","pdv_rapido","products","categories","product_groups","variants","inventory","customers","suppliers","sales","cash_register","finance_basic","crediario","fiscal_basic","reports_basic","sellers","quotes","purchase_orders","replenishment","store_transfers","commissions","returns","reports_advanced","fiscal_entries","import_export","labels","multi_store","priority_support","whatsapp_chatbot","ecommerce","logistics","assemblies","max_support"]'::jsonb
);
