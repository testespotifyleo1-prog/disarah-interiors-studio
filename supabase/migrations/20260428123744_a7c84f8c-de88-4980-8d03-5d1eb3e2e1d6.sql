-- Contas legadas (sem plan_id) ganham 2 créditos de IA por mês
CREATE OR REPLACE FUNCTION public.grant_monthly_ai_credits(_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_acc RECORD;
  v_plan RECORD;
  v_balance RECORD;
  v_legacy_monthly INT := 2; -- créditos mensais para contas legadas
  v_grant INT := 0;
  v_source_label text;
BEGIN
  SELECT * INTO v_acc FROM public.accounts WHERE id = _account_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'account_not_found'); END IF;

  -- Garante balance
  INSERT INTO public.ai_credit_balances (account_id) VALUES (_account_id)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT * INTO v_balance FROM public.ai_credit_balances WHERE account_id = _account_id;

  -- Já concedido este mês?
  IF v_balance.last_monthly_grant_at IS NOT NULL
     AND date_trunc('month', v_balance.last_monthly_grant_at) = date_trunc('month', now()) THEN
    RETURN jsonb_build_object('success', true, 'granted', 0, 'already_granted_this_month', true);
  END IF;

  -- Sem plano = LEGADO = ganha 2 créditos/mês (e pode comprar pacotes)
  IF v_acc.plan_id IS NULL THEN
    v_grant := v_legacy_monthly;
    v_source_label := 'Concessão mensal — Conta Legada (' || v_grant || ' créditos)';

    UPDATE public.ai_credit_balances
      SET plan_credits = v_grant,
          last_monthly_grant_at = now(),
          updated_at = now()
      WHERE account_id = _account_id;

    IF v_grant > 0 THEN
      INSERT INTO public.ai_credit_transactions (account_id, delta, source, notes)
      VALUES (_account_id, v_grant, 'plan_monthly', v_source_label);
    END IF;

    RETURN jsonb_build_object('success', true, 'granted', v_grant, 'reason', 'legacy_account');
  END IF;

  -- Plano normal
  SELECT * INTO v_plan FROM public.plans WHERE id = v_acc.plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  v_grant := COALESCE(v_plan.ai_credits_monthly, 0);

  UPDATE public.ai_credit_balances
    SET plan_credits = v_grant,
        last_monthly_grant_at = now(),
        updated_at = now()
    WHERE account_id = _account_id;

  IF v_grant > 0 THEN
    INSERT INTO public.ai_credit_transactions (account_id, delta, source, notes)
    VALUES (_account_id, v_grant, 'plan_monthly',
            'Concessão mensal — Plano ' || v_plan.name);
  END IF;

  RETURN jsonb_build_object('success', true, 'granted', v_grant);
END;
$function$;