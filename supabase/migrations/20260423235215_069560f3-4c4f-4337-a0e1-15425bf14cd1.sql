-- 1) PIX payment requests (manual)
CREATE TABLE public.pix_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  billing_cycle text NOT NULL DEFAULT 'monthly', -- 'monthly' | 'yearly'
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  proof_url text,
  support_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  activated_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pix_payment_requests_account ON public.pix_payment_requests(account_id);
CREATE INDEX idx_pix_payment_requests_status ON public.pix_payment_requests(status);

ALTER TABLE public.pix_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account owners/admins can view their pix requests"
  ON public.pix_payment_requests FOR SELECT TO authenticated
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]) OR is_super_admin());

CREATE POLICY "Account owners/admins can create pix requests"
  ON public.pix_payment_requests FOR INSERT TO authenticated
  WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]) AND requested_by = auth.uid());

CREATE POLICY "Super admins can update pix requests"
  ON public.pix_payment_requests FOR UPDATE TO authenticated
  USING (is_super_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.pix_payment_requests;

-- 2) Add attachment_url to support_messages
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS attachment_type text;

-- 3) Storage bucket for payment proofs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Owners/admins can upload to their account folder; super admin can read all
CREATE POLICY "Account members can upload payment proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = ANY (
      SELECT id::text FROM public.accounts WHERE id = ANY (get_user_account_ids(auth.uid()))
    )
  );

CREATE POLICY "Account members can view their payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1] = ANY (
        SELECT id::text FROM public.accounts WHERE id = ANY (get_user_account_ids(auth.uid()))
      )
    )
  );

-- 4) Storage bucket for support attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members can upload support attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = ANY (
      SELECT id::text FROM public.accounts WHERE id = ANY (get_user_account_ids(auth.uid()))
    )
  );

CREATE POLICY "Members and super admins can view support attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1] = ANY (
        SELECT id::text FROM public.accounts WHERE id = ANY (get_user_account_ids(auth.uid()))
      )
    )
  );

-- 5) Function to approve a PIX request and activate the plan
CREATE OR REPLACE FUNCTION public.approve_pix_payment(
  _request_id uuid,
  _months integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req record;
  _new_until timestamptz;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can approve PIX payments';
  END IF;

  SELECT * INTO _req FROM public.pix_payment_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PIX request not found'; END IF;
  IF _req.status = 'approved' THEN RAISE EXCEPTION 'Already approved'; END IF;

  _new_until := now() + (_months || ' months')::interval;

  UPDATE public.accounts
  SET plan_id = _req.plan_id,
      plan_status = 'active',
      pix_plan_id = _req.plan_id,
      pix_access_until = _new_until
  WHERE id = _req.account_id;

  UPDATE public.pix_payment_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      activated_until = _new_until,
      updated_at = now()
  WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'access_until', _new_until);
END;
$$;

-- 6) Function to reject a PIX request
CREATE OR REPLACE FUNCTION public.reject_pix_payment(
  _request_id uuid,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can reject PIX payments';
  END IF;

  UPDATE public.pix_payment_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = _reason,
      updated_at = now()
  WHERE id = _request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7) Seed PIX site settings
INSERT INTO public.site_settings (key, value) VALUES
  ('pix_key', ''),
  ('pix_holder_name', 'Typos ERP'),
  ('pix_key_type', 'cnpj')
ON CONFLICT (key) DO NOTHING;