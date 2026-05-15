
-- Campanhas de Email (Ofertas e comunicações)
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_label TEXT,
  cta_url TEXT,
  image_url TEXT,
  highlight_price TEXT,
  highlight_old_price TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  audience TEXT NOT NULL DEFAULT 'all_customers',
  total_sent INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_campaigns_account ON public.email_campaigns(account_id);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their account campaigns"
  ON public.email_campaigns FOR SELECT
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Owners/Admins/Managers can manage campaigns"
  ON public.email_campaigns FOR ALL
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]))
  WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role,'manager'::account_role]));

CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Logs de envios
CREATE TABLE public.email_send_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  resend_id TEXT,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_send_logs_account ON public.email_send_logs(account_id, created_at DESC);
CREATE INDEX idx_email_send_logs_campaign ON public.email_send_logs(campaign_id);

ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their account email logs"
  ON public.email_send_logs FOR SELECT
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Service role inserts logs"
  ON public.email_send_logs FOR INSERT
  WITH CHECK (public.is_account_member(auth.uid(), account_id));
