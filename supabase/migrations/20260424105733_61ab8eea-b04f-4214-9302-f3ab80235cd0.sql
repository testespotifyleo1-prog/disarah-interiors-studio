-- Função de updated_at (caso não exista)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.mp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  store_id uuid NOT NULL UNIQUE,
  access_token text,
  public_key text,
  mp_user_id text,
  nickname text,
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'disconnected',
  point_device_id text,
  point_device_name text,
  enabled_methods jsonb NOT NULL DEFAULT '["pix","credit_card","debit_card"]'::jsonb,
  last_error text,
  connected_at timestamptz,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_connections_account ON public.mp_connections(account_id);

ALTER TABLE public.mp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage mp connections"
ON public.mp_connections FOR ALL
USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]))
WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Members view mp connections"
ON public.mp_connections FOR SELECT
USING (is_account_member(auth.uid(), account_id));

CREATE TABLE IF NOT EXISTS public.mp_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  store_id uuid NOT NULL,
  connection_id uuid REFERENCES public.mp_connections(id) ON DELETE SET NULL,
  sale_id uuid,
  external_reference text,
  source text NOT NULL DEFAULT 'pdv',
  method text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  mp_payment_id text,
  mp_preference_id text,
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_copy_paste text,
  pix_expires_at timestamptz,
  payer_email text,
  payer_document text,
  installments int,
  card_brand text,
  point_device_id text,
  raw_payload jsonb,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_payments_account ON public.mp_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_sale ON public.mp_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_mp_id ON public.mp_payments(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_mp_payments_external_ref ON public.mp_payments(external_reference);

ALTER TABLE public.mp_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage mp payments"
ON public.mp_payments FOR ALL
USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]))
WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Members view mp payments"
ON public.mp_payments FOR SELECT
USING (is_account_member(auth.uid(), account_id));

CREATE TRIGGER mp_connections_set_updated_at
BEFORE UPDATE ON public.mp_connections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER mp_payments_set_updated_at
BEFORE UPDATE ON public.mp_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mp_payments;