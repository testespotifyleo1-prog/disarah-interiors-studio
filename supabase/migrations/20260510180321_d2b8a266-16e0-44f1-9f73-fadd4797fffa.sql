DROP VIEW IF EXISTS public.sales_goals_progress;
CREATE VIEW public.sales_goals_progress
WITH (security_invoker=true) AS
SELECT g.id, g.account_id, g.store_id, g.seller_user_id, g.scope,
  g.period_start, g.period_end, g.target_amount, g.bonus_amount, g.active,
  COALESCE((
    SELECT SUM(s.total) FROM public.sales s
    WHERE s.account_id = g.account_id AND s.status = 'paid'
      AND DATE(s.created_at) BETWEEN g.period_start AND g.period_end
      AND (g.store_id IS NULL OR s.store_id = g.store_id)
      AND (g.seller_user_id IS NULL OR s.seller_user_id = g.seller_user_id)
  ), 0) AS achieved_amount
FROM public.sales_goals g;