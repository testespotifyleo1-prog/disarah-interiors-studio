
-- Create assembly status enum
CREATE TYPE public.assembly_status AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'canceled');

-- Create assemblers table (montadores)
CREATE TABLE public.assemblers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assemblers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage assemblers" ON public.assemblers
  FOR ALL TO authenticated
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Users can view assemblers" ON public.assemblers
  FOR SELECT TO authenticated
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

-- Create assemblies table (montagens)
CREATE TABLE public.assemblies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  assembler_id uuid REFERENCES public.assemblers(id) ON DELETE SET NULL,
  status assembly_status NOT NULL DEFAULT 'pending',
  scheduled_date date,
  scheduled_time text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assemblies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage assemblies" ON public.assemblies
  FOR ALL TO authenticated
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Users can view assemblies" ON public.assemblies
  FOR SELECT TO authenticated
  USING (
    (account_id = ANY(get_user_account_ids(auth.uid()))) 
    AND (
      EXISTS (SELECT 1 FROM sales s WHERE s.id = assemblies.sale_id AND s.seller_user_id = auth.uid())
      OR has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])
    )
  );

-- Trigger for updated_at on assemblies
CREATE TRIGGER set_assemblies_updated_at
  BEFORE UPDATE ON public.assemblies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-generate SKU function
CREATE OR REPLACE FUNCTION public.generate_next_sku(_account_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'SKU-' || LPAD(
    (COALESCE(
      (SELECT MAX(SUBSTRING(sku FROM 'SKU-(\d+)')::int) 
       FROM public.products 
       WHERE account_id = _account_id AND sku ~ '^SKU-\d+$'),
      0
    ) + 1)::text,
    4, '0'
  )
$$;

-- Edge function for resetting account data
CREATE OR REPLACE FUNCTION public.reset_account_data(_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only owners can reset
  IF NOT has_account_role(auth.uid(), _account_id, ARRAY['owner'::account_role]) THEN
    RAISE EXCEPTION 'Apenas o proprietário pode resetar os dados';
  END IF;

  -- Delete in correct order to respect FK constraints
  DELETE FROM public.assemblies WHERE account_id = _account_id;
  DELETE FROM public.fiscal_documents WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id);
  DELETE FROM public.commissions WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  DELETE FROM public.deliveries WHERE account_id = _account_id;
  DELETE FROM public.payments WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE account_id = _account_id);
  DELETE FROM public.sales WHERE account_id = _account_id;
  DELETE FROM public.import_job_errors WHERE job_id IN (SELECT id FROM public.import_jobs WHERE account_id = _account_id);
  DELETE FROM public.import_jobs WHERE account_id = _account_id;
  DELETE FROM public.inventory WHERE store_id IN (SELECT id FROM public.stores WHERE account_id = _account_id);
  DELETE FROM public.customers WHERE account_id = _account_id;
  DELETE FROM public.products WHERE account_id = _account_id;
  DELETE FROM public.assemblers WHERE account_id = _account_id;
  DELETE FROM public.drivers WHERE account_id = _account_id;
END;
$$;
