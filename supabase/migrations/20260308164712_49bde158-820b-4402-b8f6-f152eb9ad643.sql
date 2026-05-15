
-- Function to calculate used credit: counts full sale amount if ANY installment is still open
CREATE OR REPLACE FUNCTION public.get_customer_used_credit(_customer_id uuid, _account_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(total_per_sale), 0)
  FROM (
    SELECT sale_id, SUM(amount) as total_per_sale
    FROM public.accounts_receivable
    WHERE customer_id = _customer_id
      AND account_id = _account_id
      AND category = 'crediário'
      AND status IN ('open', 'paid')
      AND sale_id IS NOT NULL
    GROUP BY sale_id
    HAVING COUNT(*) FILTER (WHERE status = 'open') > 0
  ) sub
$$;
