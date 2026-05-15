
CREATE TABLE public.product_price_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Atacado',
  min_qty NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_tiers_product ON public.product_price_tiers(product_id);

ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view price tiers"
ON public.product_price_tiers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_price_tiers.product_id
  AND p.account_id = ANY(get_user_account_ids(auth.uid()))
));

CREATE POLICY "Admins can manage price tiers"
ON public.product_price_tiers FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_price_tiers.product_id
  AND has_account_role(auth.uid(), p.account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])
));
