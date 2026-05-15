-- Add manager_pin column to store_memberships (PIN per manager per store)
ALTER TABLE public.store_memberships
ADD COLUMN IF NOT EXISTS manager_pin text;

-- RPC: verify if a PIN is valid for the account (owner_pin) OR for any active manager in the account
-- Returns the user_id of the authorizer if valid, else NULL
CREATE OR REPLACE FUNCTION public.verify_account_pin(_account_id uuid, _pin text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_pin text;
  v_owner_user_id uuid;
  v_manager_user_id uuid;
BEGIN
  IF _pin IS NULL OR length(trim(_pin)) = 0 THEN
    RETURN NULL;
  END IF;

  -- Check owner PIN
  SELECT owner_pin, owner_user_id INTO v_owner_pin, v_owner_user_id
  FROM public.accounts WHERE id = _account_id;

  IF v_owner_pin IS NOT NULL AND v_owner_pin = _pin THEN
    RETURN v_owner_user_id;
  END IF;

  -- Check manager PINs (any manager in this account, via store_memberships)
  SELECT sm.user_id INTO v_manager_user_id
  FROM public.store_memberships sm
  JOIN public.stores s ON s.id = sm.store_id
  JOIN public.memberships m ON m.user_id = sm.user_id AND m.account_id = s.account_id
  WHERE s.account_id = _account_id
    AND sm.manager_pin = _pin
    AND sm.is_active = true
    AND m.role = 'manager'
    AND m.is_active = true
  LIMIT 1;

  RETURN v_manager_user_id;
END;
$$;

-- Update credit override approval to also accept manager PINs
CREATE OR REPLACE FUNCTION public.approve_credit_override_with_pin(_request_id uuid, _pin text, _account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorizer_id uuid;
BEGIN
  v_authorizer_id := public.verify_account_pin(_account_id, _pin);

  IF v_authorizer_id IS NULL THEN
    RAISE EXCEPTION 'PIN incorreto ou não configurado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.credit_override_requests
    WHERE id = _request_id AND account_id = _account_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já processada';
  END IF;

  UPDATE public.credit_override_requests
  SET status = 'approved',
      approved_by = v_authorizer_id,
      approved_at = now(),
      authorization_type = 'pin',
      authorized_amount = excess_amount
  WHERE id = _request_id;
END;
$$;

-- Allow managers to be created via memberships (role already supports it via enum)
-- Allow managers to update their own manager_pin
CREATE POLICY "Managers can update own manager_pin"
ON public.store_memberships
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());