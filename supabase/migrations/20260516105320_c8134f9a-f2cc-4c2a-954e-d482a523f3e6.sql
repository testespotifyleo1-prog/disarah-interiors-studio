CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT NULL::text, _user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Cancela recebíveis em aberto vinculados à venda (não mexe nos já pagos)
  UPDATE public.accounts_receivable
     SET status = 'cancelled'
   WHERE sale_id = _sale_id
     AND account_id = public.current_account_id()
     AND status IN ('open','partial','overdue');

  -- Cancela comissões pendentes vinculadas à venda
  UPDATE public.commissions
     SET status = 'cancelled',
         paid = false
   WHERE sale_id = _sale_id
     AND account_id = public.current_account_id()
     AND status <> 'paid';
END
$function$;

-- mesma cascata para a assinatura antiga
CREATE OR REPLACE FUNCTION public.cancel_sale(sale_id uuid, reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_account_member(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.cancel_sale(sale_id, reason, NULL::uuid);
END
$function$;

-- Reconcilia vendas já canceladas (limpa recebíveis/comissões antigos)
UPDATE public.accounts_receivable ar
   SET status = 'cancelled'
  FROM public.sales s
 WHERE ar.sale_id = s.id
   AND s.status = 'cancelled'
   AND ar.status IN ('open','partial','overdue');

UPDATE public.commissions c
   SET status = 'cancelled', paid = false
  FROM public.sales s
 WHERE c.sale_id = s.id
   AND s.status = 'cancelled'
   AND c.status <> 'paid';