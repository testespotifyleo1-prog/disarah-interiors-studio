-- 1. Sinal + Saldo na Entrega
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS down_payment numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_balance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_on_delivery boolean NOT NULL DEFAULT false;

-- 2. Descrição longa para e-commerce
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description_long text;

-- 3. Galeria de fotos por variação (até 6)
CREATE TABLE IF NOT EXISTS public.product_variant_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variant_images_variant
  ON public.product_variant_images(variant_id);

ALTER TABLE public.product_variant_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view variant images"
ON public.product_variant_images FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = product_variant_images.variant_id
      AND p.account_id = ANY(get_user_account_ids(auth.uid()))
  )
);

CREATE POLICY "Admins can manage variant images"
ON public.product_variant_images FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = product_variant_images.variant_id
      AND has_account_role(auth.uid(), p.account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])
  )
);

-- Limite de 6 imagens por variação (trigger)
CREATE OR REPLACE FUNCTION public.enforce_variant_image_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.product_variant_images WHERE variant_id = NEW.variant_id) >= 6 THEN
    RAISE EXCEPTION 'Limite de 6 imagens por variação atingido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variant_image_limit ON public.product_variant_images;
CREATE TRIGGER trg_variant_image_limit
  BEFORE INSERT ON public.product_variant_images
  FOR EACH ROW EXECUTE FUNCTION public.enforce_variant_image_limit();