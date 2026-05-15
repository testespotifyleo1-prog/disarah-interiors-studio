ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pix_access_until timestamptz;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pix_plan_id uuid REFERENCES public.plans(id);