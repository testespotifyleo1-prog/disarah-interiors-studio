
ALTER TABLE public.birthday_campaign_settings
  ADD COLUMN IF NOT EXISTS email_html_template TEXT,
  ADD COLUMN IF NOT EXISTS template_mode TEXT NOT NULL DEFAULT 'default' CHECK (template_mode IN ('default','html'));
