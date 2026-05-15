
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS promo_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS promo_starts_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS promo_ends_at timestamptz DEFAULT NULL;
