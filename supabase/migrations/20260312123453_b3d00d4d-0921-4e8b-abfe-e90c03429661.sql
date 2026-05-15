CREATE POLICY "Sellers can delete own draft sales"
ON public.sales
FOR DELETE
TO public
USING (
  (account_id = ANY (get_user_account_ids(auth.uid())))
  AND seller_user_id = auth.uid()
  AND status = 'draft'
);