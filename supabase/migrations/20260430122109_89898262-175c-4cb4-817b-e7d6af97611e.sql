-- 1. Add discount type / value / prefix to birthday_campaign_settings
ALTER TABLE public.birthday_campaign_settings
  ADD COLUMN IF NOT EXISTS coupon_discount_type text NOT NULL DEFAULT 'percent' CHECK (coupon_discount_type IN ('percent','fixed')),
  ADD COLUMN IF NOT EXISTS coupon_discount_value numeric(12,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS coupon_prefix text DEFAULT 'ANIVER';

-- 2. Birthday coupons table (one per customer per year, unique single-use code)
CREATE TABLE IF NOT EXISTS public.birthday_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  store_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric(12,2) NOT NULL,
  description text,
  valid_until date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired','canceled')),
  redeemed_sale_id uuid,
  redeemed_at timestamptz,
  redeemed_by uuid,
  source text NOT NULL DEFAULT 'birthday',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_birthday_coupons_account ON public.birthday_coupons(account_id);
CREATE INDEX IF NOT EXISTS idx_birthday_coupons_customer ON public.birthday_coupons(customer_id);
CREATE INDEX IF NOT EXISTS idx_birthday_coupons_code ON public.birthday_coupons(code);
CREATE INDEX IF NOT EXISTS idx_birthday_coupons_status ON public.birthday_coupons(status);

ALTER TABLE public.birthday_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view their birthday coupons"
ON public.birthday_coupons FOR SELECT
USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Account members can update their birthday coupons"
ON public.birthday_coupons FOR UPDATE
USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Account admins can delete birthday coupons"
ON public.birthday_coupons FOR DELETE
USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]));

-- (No insert policy: only edge functions / service role insert these)

-- 3. Helper: generate a unique random coupon code with optional prefix
CREATE OR REPLACE FUNCTION public.generate_unique_birthday_coupon_code(_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := COALESCE(NULLIF(trim(_prefix), ''), 'ANIVER');
  v_code text;
  v_attempt int := 0;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    -- 8-char base36 random suffix
    v_code := upper(v_prefix) || '-' ||
      upper(substring(translate(encode(gen_random_bytes(6), 'base64'), '+/=', 'XYZ'), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.birthday_coupons WHERE code = v_code);
    IF v_attempt > 8 THEN
      v_code := upper(v_prefix) || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      EXIT;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- 4. Validate a birthday coupon (callable from clients/edge functions)
-- Returns coupon details if valid, raises exception otherwise.
CREATE OR REPLACE FUNCTION public.validate_birthday_coupon(
  _code text,
  _account_id uuid,
  _customer_id uuid,
  _subtotal numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount numeric(12,2);
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RAISE EXCEPTION 'Cupom inválido';
  END IF;

  SELECT * INTO v_coupon FROM public.birthday_coupons
   WHERE code = upper(trim(_code))
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom não encontrado';
  END IF;

  IF v_coupon.account_id <> _account_id THEN
    RAISE EXCEPTION 'Cupom não pertence a esta loja';
  END IF;

  IF v_coupon.status = 'used' THEN
    RAISE EXCEPTION 'Cupom já foi utilizado';
  END IF;

  IF v_coupon.status <> 'active' THEN
    RAISE EXCEPTION 'Cupom não está ativo';
  END IF;

  IF v_coupon.valid_until < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cupom expirado em %', to_char(v_coupon.valid_until, 'DD/MM/YYYY');
  END IF;

  IF _customer_id IS NULL OR v_coupon.customer_id <> _customer_id THEN
    RAISE EXCEPTION 'Este cupom é exclusivo do cliente vinculado. Selecione o cliente correto.';
  END IF;

  IF v_coupon.discount_type = 'percent' THEN
    v_discount := ROUND(_subtotal * v_coupon.discount_value / 100, 2);
  ELSE
    v_discount := LEAST(v_coupon.discount_value, _subtotal);
  END IF;

  RETURN jsonb_build_object(
    'id', v_coupon.id,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'valid_until', v_coupon.valid_until,
    'description', v_coupon.description,
    'customer_id', v_coupon.customer_id
  );
END;
$$;

-- 5. Redeem (mark as used) — atomic, single-use
CREATE OR REPLACE FUNCTION public.redeem_birthday_coupon(
  _code text,
  _account_id uuid,
  _customer_id uuid,
  _sale_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
BEGIN
  SELECT * INTO v_coupon FROM public.birthday_coupons
    WHERE code = upper(trim(_code))
    FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Cupom não encontrado'; END IF;
  IF v_coupon.account_id <> _account_id THEN RAISE EXCEPTION 'Cupom não pertence a esta loja'; END IF;
  IF v_coupon.status = 'used' THEN RAISE EXCEPTION 'Cupom já foi utilizado'; END IF;
  IF v_coupon.status <> 'active' THEN RAISE EXCEPTION 'Cupom não está ativo'; END IF;
  IF v_coupon.valid_until < CURRENT_DATE THEN RAISE EXCEPTION 'Cupom expirado'; END IF;
  IF _customer_id IS NULL OR v_coupon.customer_id <> _customer_id THEN
    RAISE EXCEPTION 'Cupom não pertence a este cliente';
  END IF;

  UPDATE public.birthday_coupons
    SET status = 'used',
        redeemed_sale_id = _sale_id,
        redeemed_at = now(),
        redeemed_by = auth.uid()
    WHERE id = v_coupon.id;

  RETURN jsonb_build_object('success', true, 'coupon_id', v_coupon.id);
END;
$$;