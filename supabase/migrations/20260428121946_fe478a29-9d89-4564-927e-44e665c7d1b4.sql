
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS landing_highlights TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_cta_label TEXT,
  ADD COLUMN IF NOT EXISTS landing_subtitle TEXT;

-- Garante que apenas um plano possa ser featured por vez (opcional via app, não constraint)
COMMENT ON COLUMN public.plans.landing_highlights IS 'Bullets exibidos no card do plano na landing page';
COMMENT ON COLUMN public.plans.is_featured IS 'Marca o plano como "Mais Popular" na landing';
COMMENT ON COLUMN public.plans.landing_cta_label IS 'Texto do botão CTA na landing (ex: "Começar agora")';
COMMENT ON COLUMN public.plans.landing_subtitle IS 'Subtítulo curto exibido na landing page';
