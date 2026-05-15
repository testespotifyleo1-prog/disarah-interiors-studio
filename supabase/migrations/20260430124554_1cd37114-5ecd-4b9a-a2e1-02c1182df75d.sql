CREATE OR REPLACE FUNCTION public.generate_unique_birthday_coupon_code(_prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix text := upper(COALESCE(NULLIF(trim(_prefix), ''), 'ANIVER'));
  v_code text;
  v_attempt int := 0;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    -- Use gen_random_uuid() (pgcrypto-free) to build an 8-char uppercase suffix
    v_code := v_prefix || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.birthday_coupons WHERE code = v_code);
    IF v_attempt > 8 THEN
      v_code := v_prefix || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      EXIT;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$function$;