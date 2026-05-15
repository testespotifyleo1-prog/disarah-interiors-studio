
-- Fix: Allow sellers to update their own draft/open sales to 'paid' status
-- The issue: USING clause requires status IN (draft, open), but without WITH CHECK,
-- the same USING is applied to the NEW row, which has status='paid' → rejected.

DROP POLICY "Users can update own draft/open sales" ON public.sales;

CREATE POLICY "Users can update own draft/open sales"
ON public.sales
FOR UPDATE
USING (
  (account_id = ANY (get_user_account_ids(auth.uid())))
  AND (
    ((seller_user_id = auth.uid()) AND (status = ANY (ARRAY['draft'::sale_status, 'open'::sale_status])))
    OR has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])
  )
)
WITH CHECK (
  (account_id = ANY (get_user_account_ids(auth.uid())))
  AND (
    (seller_user_id = auth.uid())
    OR has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])
  )
);
