
-- Function to approve credit override with owner PIN (bypasses RLS since it's SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.approve_credit_override_with_pin(
  _request_id uuid,
  _pin text,
  _account_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_pin text;
  v_owner_user_id uuid;
BEGIN
  -- Get the owner's PIN and user_id
  SELECT owner_pin, owner_user_id INTO v_owner_pin, v_owner_user_id
  FROM public.accounts
  WHERE id = _account_id;

  IF v_owner_pin IS NULL OR v_owner_pin = '' THEN
    RAISE EXCEPTION 'PIN do dono não configurado';
  END IF;

  IF v_owner_pin != _pin THEN
    RAISE EXCEPTION 'PIN incorreto';
  END IF;

  -- Verify the request belongs to this account and is pending
  IF NOT EXISTS (
    SELECT 1 FROM public.credit_override_requests
    WHERE id = _request_id AND account_id = _account_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já processada';
  END IF;

  -- Approve the request
  UPDATE public.credit_override_requests
  SET status = 'approved',
      approved_by = v_owner_user_id,
      approved_at = now(),
      authorization_type = 'pin',
      authorized_amount = excess_amount
  WHERE id = _request_id;
END;
$$;
