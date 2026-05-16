
ALTER TABLE public.store_credits
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
