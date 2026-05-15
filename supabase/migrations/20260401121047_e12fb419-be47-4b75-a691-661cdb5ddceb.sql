
ALTER TABLE public.store_ecommerce_settings 
  ADD COLUMN IF NOT EXISTS inline_banners jsonb DEFAULT '[]';

ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS weight numeric,
  ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS category text;
