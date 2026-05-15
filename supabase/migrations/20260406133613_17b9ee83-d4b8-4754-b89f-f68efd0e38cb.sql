
CREATE TABLE public.email_verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('signup', 'recovery', 'email_change')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '60 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Edge functions use service role, so RLS doesn't block them
-- But we need a policy for the anon key used from frontend verify flow
CREATE POLICY "Anyone can verify codes"
ON public.email_verification_codes
FOR SELECT
USING (true);

CREATE POLICY "Edge functions can insert codes"
ON public.email_verification_codes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Edge functions can update codes"
ON public.email_verification_codes
FOR UPDATE
USING (true);

-- Index for fast lookup
CREATE INDEX idx_verification_codes_email_type ON public.email_verification_codes (email, type, used);

-- Auto-cleanup old codes (optional trigger)
CREATE OR REPLACE FUNCTION public.cleanup_expired_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < now() - interval '1 day';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cleanup_codes
AFTER INSERT ON public.email_verification_codes
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_codes();
