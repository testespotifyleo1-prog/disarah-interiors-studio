-- 1. Nova coluna em accounts (override por conta)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS ai_simulation_enabled boolean;

-- 2. Tabela principal
CREATE TABLE IF NOT EXISTS public.ai_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  environment_image_url TEXT NOT NULL,
  generated_image_url TEXT,
  user_notes TEXT,
  space_width_cm NUMERIC,
  space_height_cm NUMERIC,
  analysis JSONB,
  suggestions JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  model TEXT NOT NULL DEFAULT 'google/gemini-3.1-flash-image-preview',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_simulations_account ON public.ai_simulations(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_simulations_product ON public.ai_simulations(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_simulations_customer ON public.ai_simulations(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_simulations_user ON public.ai_simulations(user_id);

ALTER TABLE public.ai_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view simulations of their account"
  ON public.ai_simulations FOR SELECT
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Members can create simulations for their account"
  ON public.ai_simulations FOR INSERT
  WITH CHECK (public.is_account_member(auth.uid(), account_id) AND user_id = auth.uid());

CREATE POLICY "Members can update simulations of their account"
  ON public.ai_simulations FOR UPDATE
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Members can delete simulations of their account"
  ON public.ai_simulations FOR DELETE
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Super admins can view all simulations"
  ON public.ai_simulations FOR SELECT
  USING (public.is_super_admin());

CREATE TRIGGER trg_ai_simulations_updated_at
  BEFORE UPDATE ON public.ai_simulations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Bucket de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-simulations', 'ai-simulations', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read ai-simulations"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ai-simulations');

CREATE POLICY "Authenticated users upload ai-simulations"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ai-simulations' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users update ai-simulations"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'ai-simulations' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users delete ai-simulations"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ai-simulations' AND auth.uid() IS NOT NULL);

-- 4. Toggle global em site_settings
INSERT INTO public.site_settings (key, value)
VALUES ('ai_simulation_enabled_global', 'true')
ON CONFLICT (key) DO NOTHING;