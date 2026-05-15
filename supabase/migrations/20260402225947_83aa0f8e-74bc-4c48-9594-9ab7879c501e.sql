
-- Add presentation tracking columns to sale_items
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS presentation_id uuid REFERENCES public.product_presentations(id),
  ADD COLUMN IF NOT EXISTS presentation_name text,
  ADD COLUMN IF NOT EXISTS sold_qty numeric,
  ADD COLUMN IF NOT EXISTS base_qty numeric;

-- Add constraints to product_presentations for data integrity
-- Unique name per product
ALTER TABLE public.product_presentations
  ADD CONSTRAINT uq_presentation_name_per_product UNIQUE (product_id, name);

-- Unique GTIN globally (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_presentation_gtin_unique
  ON public.product_presentations (gtin) WHERE gtin IS NOT NULL AND is_active = true;

-- Conversion factor must be positive
ALTER TABLE public.product_presentations
  ADD CONSTRAINT chk_conversion_factor_positive CHECK (conversion_factor > 0);

-- Index for fast GTIN lookup on presentations
CREATE INDEX IF NOT EXISTS idx_presentation_gtin_lookup
  ON public.product_presentations (gtin) WHERE gtin IS NOT NULL AND is_active = true;
