
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT NULL, _user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_account_member(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.sales
     SET status = 'cancelled',
         cancelled_reason = _reason,
         cancelled_at = now()
   WHERE id = _sale_id
     AND account_id = public.current_account_id();
END
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text, uuid) TO authenticated, anon;
