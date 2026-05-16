CREATE OR REPLACE FUNCTION public.verify_account_pin(_account_id uuid, _pin text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_pin text;
  _owner_pin_hash text;
  _manager_user uuid;
BEGIN
  IF _pin IS NULL OR length(trim(_pin)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT owner_pin, owner_pin_hash INTO _owner_pin, _owner_pin_hash
  FROM public.accounts WHERE id = _account_id;

  IF _owner_pin IS NOT NULL AND _owner_pin = _pin THEN
    RETURN (SELECT user_id FROM public.memberships
            WHERE account_id = _account_id AND role = 'owner' AND is_active
            LIMIT 1);
  END IF;

  IF _owner_pin_hash IS NOT NULL AND _owner_pin_hash = crypt(_pin, _owner_pin_hash) THEN
    RETURN (SELECT user_id FROM public.memberships
            WHERE account_id = _account_id AND role = 'owner' AND is_active
            LIMIT 1);
  END IF;

  -- Manager PIN via store_memberships (if table exists)
  BEGIN
    EXECUTE $q$
      SELECT sm.user_id
      FROM public.store_memberships sm
      JOIN public.stores s ON s.id = sm.store_id
      WHERE s.account_id = $1
        AND sm.is_active = true
        AND sm.manager_pin = $2
      LIMIT 1
    $q$ INTO _manager_user USING _account_id, _pin;
    IF _manager_user IS NOT NULL THEN
      RETURN _manager_user;
    END IF;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_account_pin(uuid, text) TO authenticated;