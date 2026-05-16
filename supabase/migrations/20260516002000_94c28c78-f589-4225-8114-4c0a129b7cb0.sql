
ALTER TABLE public.store_credits
  DROP CONSTRAINT IF EXISTS store_credits_sale_id_fkey;

ALTER TABLE public.store_credits
  ADD CONSTRAINT store_credits_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
