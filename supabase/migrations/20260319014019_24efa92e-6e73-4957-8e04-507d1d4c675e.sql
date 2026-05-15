
-- Allow sellers to manage products (insert/update)
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Members can manage products"
  ON public.products
  FOR ALL
  TO public
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role, 'seller'::account_role]))
  WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role, 'seller'::account_role]));

-- Allow sellers to manage customers (insert/update)
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
CREATE POLICY "Members can manage customers"
  ON public.customers
  FOR ALL
  TO public
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role, 'seller'::account_role]))
  WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role, 'seller'::account_role]));
