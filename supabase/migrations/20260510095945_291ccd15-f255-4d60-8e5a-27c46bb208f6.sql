ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'support';

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN ('support','feature_request'));

CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);