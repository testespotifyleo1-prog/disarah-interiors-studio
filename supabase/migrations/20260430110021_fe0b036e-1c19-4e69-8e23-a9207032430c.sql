ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birth_date DATE;
CREATE INDEX IF NOT EXISTS idx_customers_birth_mmdd ON public.customers (
  (EXTRACT(MONTH FROM birth_date)::int),
  (EXTRACT(DAY FROM birth_date)::int)
) WHERE birth_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.birthday_campaign_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  store_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  send_email BOOLEAN NOT NULL DEFAULT true,
  email_subject TEXT NOT NULL DEFAULT 'Feliz aniversário! 🎉',
  email_message TEXT NOT NULL DEFAULT 'Olá {nome}, a {loja} deseja um feliz aniversário! 🎂',
  coupon_enabled BOOLEAN NOT NULL DEFAULT false,
  coupon_code TEXT,
  coupon_description TEXT,
  coupon_valid_days INT NOT NULL DEFAULT 30,
  send_hour INT NOT NULL DEFAULT 9 CHECK (send_hour BETWEEN 0 AND 23),
  from_name TEXT,
  reply_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.birthday_campaign_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read birthday settings" ON public.birthday_campaign_settings
  FOR SELECT USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins manage birthday settings" ON public.birthday_campaign_settings
  FOR ALL USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]))
  WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]));

CREATE TRIGGER trg_birthday_settings_updated_at BEFORE UPDATE ON public.birthday_campaign_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.birthday_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  store_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  sent_year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, customer_id, channel, sent_year)
);

ALTER TABLE public.birthday_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read birthday log" ON public.birthday_send_log
  FOR SELECT USING (is_account_member(auth.uid(), account_id));

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;