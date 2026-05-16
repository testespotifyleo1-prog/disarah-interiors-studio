ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variant_options text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'g';