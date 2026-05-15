
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all settings
CREATE POLICY "Super admins can manage site_settings"
  ON public.site_settings
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Anyone can read site_settings (needed for footer display)
CREATE POLICY "Anyone can read site_settings"
  ON public.site_settings
  FOR SELECT
  USING (true);

-- Insert default social media entries
INSERT INTO public.site_settings (key, value) VALUES
  ('social_instagram', ''),
  ('social_facebook', ''),
  ('social_linkedin', '');
