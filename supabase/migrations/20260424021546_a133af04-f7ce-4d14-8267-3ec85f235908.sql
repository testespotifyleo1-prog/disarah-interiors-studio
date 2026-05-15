
CREATE TABLE public.integration_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  key_name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, key_name)
);

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view integration credentials"
ON public.integration_credentials FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can insert integration credentials"
ON public.integration_credentials FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update integration credentials"
ON public.integration_credentials FOR UPDATE
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can delete integration credentials"
ON public.integration_credentials FOR DELETE
TO authenticated
USING (public.is_super_admin());

CREATE TRIGGER trg_integration_credentials_updated_at
BEFORE UPDATE ON public.integration_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
