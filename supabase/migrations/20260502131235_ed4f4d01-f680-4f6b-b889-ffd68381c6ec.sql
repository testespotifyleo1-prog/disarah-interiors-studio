-- Galeria de imagens por produto (até 4 imagens adicionais por produto)
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id, sort_order);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Membros da conta podem ver as imagens dos produtos da sua conta
CREATE POLICY "Account members can view product images"
ON public.product_images FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.memberships m ON m.account_id = p.account_id
    WHERE p.id = product_images.product_id
      AND m.user_id = auth.uid()
      AND m.is_active = true
  )
);

CREATE POLICY "Account members can insert product images"
ON public.product_images FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.memberships m ON m.account_id = p.account_id
    WHERE p.id = product_images.product_id
      AND m.user_id = auth.uid()
      AND m.is_active = true
  )
);

CREATE POLICY "Account members can update product images"
ON public.product_images FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.memberships m ON m.account_id = p.account_id
    WHERE p.id = product_images.product_id
      AND m.user_id = auth.uid()
      AND m.is_active = true
  )
);

CREATE POLICY "Account members can delete product images"
ON public.product_images FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.memberships m ON m.account_id = p.account_id
    WHERE p.id = product_images.product_id
      AND m.user_id = auth.uid()
      AND m.is_active = true
  )
);

-- Galeria pública: leitura aberta (necessária para o storefront/e-commerce)
CREATE POLICY "Public can view product images"
ON public.product_images FOR SELECT
USING (true);
