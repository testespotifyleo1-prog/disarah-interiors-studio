
-- Table for product presentations (fractioning/packaging)
CREATE TABLE public.product_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  conversion_factor NUMERIC NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  is_purchase BOOLEAN NOT NULL DEFAULT false,
  is_sale BOOLEAN NOT NULL DEFAULT false,
  price NUMERIC,
  gtin TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_presentations ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX idx_product_presentations_product ON public.product_presentations (product_id) WHERE is_active = true;
CREATE INDEX idx_product_presentations_gtin ON public.product_presentations (gtin) WHERE gtin IS NOT NULL;

-- RLS: view if member of the product's account
CREATE POLICY "Users can view presentations"
  ON public.product_presentations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_presentations.product_id
      AND p.account_id = ANY(get_user_account_ids(auth.uid()))
  ));

-- RLS: manage if admin/owner/manager
CREATE POLICY "Admins can manage presentations"
  ON public.product_presentations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_presentations.product_id
      AND has_account_role(auth.uid(), p.account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])
  ));
