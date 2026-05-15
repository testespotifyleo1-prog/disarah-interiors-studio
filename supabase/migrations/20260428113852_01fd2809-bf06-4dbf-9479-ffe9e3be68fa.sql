
-- 1) Coluna em plans para créditos mensais
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS ai_credits_monthly INTEGER NOT NULL DEFAULT 0;

-- 2) Pacotes de créditos avulsos
CREATE TABLE public.ai_credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  highlight BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_packages_read_authenticated" ON public.ai_credit_packages
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "ai_packages_super_admin_all" ON public.ai_credit_packages
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER set_ai_packages_updated_at
  BEFORE UPDATE ON public.ai_credit_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Saldo por conta
CREATE TABLE public.ai_credit_balances (
  account_id UUID PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_credits INTEGER NOT NULL DEFAULT 0,
  purchased_credits INTEGER NOT NULL DEFAULT 0,
  total_consumed INTEGER NOT NULL DEFAULT 0,
  last_monthly_grant_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_balance_read_members" ON public.ai_credit_balances
  FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), account_id) OR public.is_super_admin());

CREATE POLICY "ai_balance_super_admin_all" ON public.ai_credit_balances
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER set_ai_balance_updated_at
  BEFORE UPDATE ON public.ai_credit_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Transações (auditoria)
CREATE TABLE public.ai_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID,
  delta INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('plan_monthly', 'purchase', 'manual_grant', 'consumption', 'refund', 'adjustment')),
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_tx_account ON public.ai_credit_transactions(account_id, created_at DESC);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_tx_read_members" ON public.ai_credit_transactions
  FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), account_id) OR public.is_super_admin());

CREATE POLICY "ai_tx_super_admin_all" ON public.ai_credit_transactions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 5) Compras (Stripe ou PIX manual)
CREATE TABLE public.ai_credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  package_id UUID REFERENCES public.ai_credit_packages(id),
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'pix')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected', 'canceled')),
  stripe_session_id TEXT,
  pix_proof_url TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_purchases_account ON public.ai_credit_purchases(account_id, created_at DESC);
CREATE INDEX idx_ai_purchases_status ON public.ai_credit_purchases(status);

ALTER TABLE public.ai_credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_purchases_read_members" ON public.ai_credit_purchases
  FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), account_id) OR public.is_super_admin());

CREATE POLICY "ai_purchases_insert_members" ON public.ai_credit_purchases
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(auth.uid(), account_id) AND user_id = auth.uid());

CREATE POLICY "ai_purchases_super_admin_all" ON public.ai_credit_purchases
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER set_ai_purchases_updated_at
  BEFORE UPDATE ON public.ai_credit_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for PIX proofs (reuse payment-proofs bucket)
-- already exists, no need to recreate

-- 6) Função: consumir 1 crédito atomicamente
CREATE OR REPLACE FUNCTION public.consume_ai_credit(_account_id UUID, _user_id UUID, _reference_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_from_plan INT := 0;
  v_from_purchased INT := 0;
BEGIN
  -- Garante que o balance existe
  INSERT INTO public.ai_credit_balances (account_id) VALUES (_account_id)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT * INTO v_balance FROM public.ai_credit_balances
    WHERE account_id = _account_id FOR UPDATE;

  IF (v_balance.plan_credits + v_balance.purchased_credits) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits',
      'plan_credits', v_balance.plan_credits, 'purchased_credits', v_balance.purchased_credits);
  END IF;

  -- Consome primeiro do plano (que reseta mensal)
  IF v_balance.plan_credits > 0 THEN
    v_from_plan := 1;
  ELSE
    v_from_purchased := 1;
  END IF;

  UPDATE public.ai_credit_balances
    SET plan_credits = plan_credits - v_from_plan,
        purchased_credits = purchased_credits - v_from_purchased,
        total_consumed = total_consumed + 1,
        updated_at = now()
    WHERE account_id = _account_id;

  INSERT INTO public.ai_credit_transactions (account_id, user_id, delta, source, reference_id, notes)
  VALUES (_account_id, _user_id, -1, 'consumption', _reference_id,
    CASE WHEN v_from_plan = 1 THEN 'Consumo (plano)' ELSE 'Consumo (comprado)' END);

  RETURN jsonb_build_object('success', true,
    'plan_credits', v_balance.plan_credits - v_from_plan,
    'purchased_credits', v_balance.purchased_credits - v_from_purchased);
END;
$$;

-- 7) Função: estornar crédito (caso simulação falhe após débito)
CREATE OR REPLACE FUNCTION public.refund_ai_credit(_account_id UUID, _reference_id UUID, _reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_credit_balances
    SET purchased_credits = purchased_credits + 1,
        total_consumed = GREATEST(0, total_consumed - 1),
        updated_at = now()
    WHERE account_id = _account_id;

  INSERT INTO public.ai_credit_transactions (account_id, delta, source, reference_id, notes)
  VALUES (_account_id, 1, 'refund', _reference_id, COALESCE(_reason, 'Estorno por falha'));
END;
$$;

-- 8) Função: garantir/resetar créditos mensais do plano
CREATE OR REPLACE FUNCTION public.grant_monthly_ai_credits(_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc RECORD;
  v_plan RECORD;
  v_balance RECORD;
  v_should_grant BOOLEAN := false;
BEGIN
  SELECT * INTO v_acc FROM public.accounts WHERE id = _account_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'account_not_found'); END IF;

  -- Garante balance
  INSERT INTO public.ai_credit_balances (account_id) VALUES (_account_id)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT * INTO v_balance FROM public.ai_credit_balances WHERE account_id = _account_id;

  -- Verifica se já foi concedido este mês
  IF v_balance.last_monthly_grant_at IS NOT NULL
     AND date_trunc('month', v_balance.last_monthly_grant_at) = date_trunc('month', now()) THEN
    RETURN jsonb_build_object('success', true, 'granted', 0, 'already_granted_this_month', true);
  END IF;

  -- Sem plano = legacy = 0 créditos do plano (precisa comprar)
  IF v_acc.plan_id IS NULL THEN
    UPDATE public.ai_credit_balances
      SET plan_credits = 0, last_monthly_grant_at = now() WHERE account_id = _account_id;
    RETURN jsonb_build_object('success', true, 'granted', 0, 'reason', 'no_plan');
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_acc.plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  -- Reset: substitui plan_credits pelo valor do plano
  UPDATE public.ai_credit_balances
    SET plan_credits = COALESCE(v_plan.ai_credits_monthly, 0),
        last_monthly_grant_at = now(),
        updated_at = now()
    WHERE account_id = _account_id;

  IF COALESCE(v_plan.ai_credits_monthly, 0) > 0 THEN
    INSERT INTO public.ai_credit_transactions (account_id, delta, source, notes)
    VALUES (_account_id, v_plan.ai_credits_monthly, 'plan_monthly',
            'Concessão mensal — Plano ' || v_plan.name);
  END IF;

  RETURN jsonb_build_object('success', true, 'granted', v_plan.ai_credits_monthly);
END;
$$;

-- 9) Função: adicionar créditos comprados (Stripe/PIX) — chamada pelo webhook ou aprovação manual
CREATE OR REPLACE FUNCTION public.add_purchased_ai_credits(_account_id UUID, _credits INTEGER, _purchase_id UUID DEFAULT NULL, _notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_credit_balances (account_id, purchased_credits) VALUES (_account_id, _credits)
  ON CONFLICT (account_id) DO UPDATE
    SET purchased_credits = ai_credit_balances.purchased_credits + _credits,
        updated_at = now();

  INSERT INTO public.ai_credit_transactions (account_id, delta, source, reference_id, notes)
  VALUES (_account_id, _credits, 'purchase', _purchase_id, _notes);
END;
$$;

-- 10) Função: ajuste manual pelo Super Admin
CREATE OR REPLACE FUNCTION public.admin_adjust_ai_credits(_account_id UUID, _delta INTEGER, _notes TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super admins podem ajustar créditos';
  END IF;

  INSERT INTO public.ai_credit_balances (account_id) VALUES (_account_id)
  ON CONFLICT (account_id) DO NOTHING;

  IF _delta >= 0 THEN
    UPDATE public.ai_credit_balances
      SET purchased_credits = purchased_credits + _delta, updated_at = now()
      WHERE account_id = _account_id;
  ELSE
    UPDATE public.ai_credit_balances
      SET purchased_credits = GREATEST(0, purchased_credits + _delta), updated_at = now()
      WHERE account_id = _account_id;
  END IF;

  INSERT INTO public.ai_credit_transactions (account_id, user_id, delta, source, notes)
  VALUES (_account_id, auth.uid(), _delta, 'adjustment', _notes);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 11) Aprovar compra PIX (manual, super admin)
CREATE OR REPLACE FUNCTION public.approve_ai_credit_pix(_purchase_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase RECORD;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super admins podem aprovar';
  END IF;

  SELECT * INTO v_purchase FROM public.ai_credit_purchases WHERE id = _purchase_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
  IF v_purchase.status <> 'pending' THEN RAISE EXCEPTION 'Compra já processada'; END IF;

  PERFORM public.add_purchased_ai_credits(
    v_purchase.account_id, v_purchase.credits, _purchase_id,
    'Compra PIX aprovada — ' || v_purchase.credits || ' créditos'
  );

  UPDATE public.ai_credit_purchases
    SET status = 'paid', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _purchase_id;

  RETURN jsonb_build_object('success', true, 'credits', v_purchase.credits);
END;
$$;

-- 12) Rejeitar compra PIX
CREATE OR REPLACE FUNCTION public.reject_ai_credit_pix(_purchase_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super admins podem rejeitar';
  END IF;

  UPDATE public.ai_credit_purchases
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = _reason
    WHERE id = _purchase_id AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 13) Defaults sensatos para os planos existentes (super admin pode ajustar depois)
UPDATE public.plans SET ai_credits_monthly = 0   WHERE slug = 'start';
UPDATE public.plans SET ai_credits_monthly = 10  WHERE slug = 'pro';
UPDATE public.plans SET ai_credits_monthly = 30  WHERE slug = 'multi';
UPDATE public.plans SET ai_credits_monthly = 100 WHERE slug = 'prime';

-- 14) Pacotes default (super admin pode editar/desativar)
INSERT INTO public.ai_credit_packages (name, credits, price_cents, sort_order, highlight, description) VALUES
  ('Pacote Inicial',    10,   1990, 1, false, '10 simulações para testar'),
  ('Pacote Popular',    30,   4990, 2, true,  '30 simulações — economize 17%'),
  ('Pacote Profissional', 100, 14990, 3, false, '100 simulações — melhor custo'),
  ('Pacote Empresarial', 500, 59900, 4, false, '500 simulações — uso intensivo');
