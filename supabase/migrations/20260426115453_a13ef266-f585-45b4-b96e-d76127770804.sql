
CREATE TABLE public.customer_ai_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  customer_id uuid,
  phone text NOT NULL,
  display_name text,
  preferred_greeting text,
  communication_style text,
  preferred_brands text[] DEFAULT '{}',
  preferred_categories text[] DEFAULT '{}',
  disliked_items text[] DEFAULT '{}',
  frequent_products text[] DEFAULT '{}',
  avg_ticket numeric(12,2) DEFAULT 0,
  total_interactions int NOT NULL DEFAULT 0,
  total_purchases int NOT NULL DEFAULT 0,
  last_interaction_at timestamptz,
  notes_summary text,
  insights_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, phone)
);

CREATE INDEX idx_customer_ai_profiles_account_phone ON public.customer_ai_profiles(account_id, phone);
CREATE INDEX idx_customer_ai_profiles_customer ON public.customer_ai_profiles(customer_id) WHERE customer_id IS NOT NULL;

ALTER TABLE public.customer_ai_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ai profiles"
  ON public.customer_ai_profiles FOR SELECT
  USING (account_id = ANY (get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage ai profiles"
  ON public.customer_ai_profiles FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE TRIGGER set_customer_ai_profiles_updated_at
BEFORE UPDATE ON public.customer_ai_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
