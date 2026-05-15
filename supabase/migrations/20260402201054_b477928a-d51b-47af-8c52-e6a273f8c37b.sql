
-- Product variants table
CREATE TABLE public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text,
  gtin text,
  price numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON public.product_variants(sku);
CREATE INDEX idx_product_variants_gtin ON public.product_variants(gtin);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage variants"
ON public.product_variants FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_variants.product_id
    AND p.account_id = ANY(get_user_account_ids(auth.uid()))
));

CREATE POLICY "Members can view variants"
ON public.product_variants FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_variants.product_id
    AND p.account_id = ANY(get_user_account_ids(auth.uid()))
));

-- Add variant_id to sale_items
ALTER TABLE public.sale_items
  ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) DEFAULT NULL;

-- Add variant_id to inventory
ALTER TABLE public.inventory
  ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) DEFAULT NULL;

-- Drop old unique constraint on inventory and add new one including variant_id
-- First check if there's a unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_store_product_variant
  ON public.inventory(store_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'));

-- Add variant_options column to products to define available option types
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variant_options jsonb DEFAULT NULL;
