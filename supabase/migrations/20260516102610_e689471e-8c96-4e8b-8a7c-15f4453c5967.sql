ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_group text DEFAULT NULL;