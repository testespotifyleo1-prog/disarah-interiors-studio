-- ============================================
-- ENUM TYPES
-- ============================================
CREATE TYPE public.account_role AS ENUM ('owner', 'admin', 'manager', 'seller');
CREATE TYPE public.store_role AS ENUM ('admin', 'manager', 'seller');
CREATE TYPE public.sale_status AS ENUM ('draft', 'open', 'paid', 'canceled');
CREATE TYPE public.payment_method AS ENUM ('pix', 'cash', 'card');
CREATE TYPE public.card_type AS ENUM ('debit', 'credit');
CREATE TYPE public.commission_status AS ENUM ('pending', 'paid');
CREATE TYPE public.delivery_type AS ENUM ('pickup', 'delivery');
CREATE TYPE public.delivery_status AS ENUM ('pending', 'assigned', 'out_for_delivery', 'delivered', 'canceled');
CREATE TYPE public.fiscal_doc_type AS ENUM ('nfe', 'nfce', 'cupom');
CREATE TYPE public.nfeio_environment AS ENUM ('prod', 'homolog');
CREATE TYPE public.import_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================
-- ACCOUNTS (Multi-tenant root)
-- ============================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MEMBERSHIPS (User-Account relationship with roles)
-- ============================================
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.account_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id)
);
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STORES
-- ============================================
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  ie TEXT,
  address_json JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, cnpj)
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STORE MEMBERSHIPS (Link seller to specific stores)
-- ============================================
CREATE TABLE public.store_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_store public.store_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);
ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PRODUCTS (Catalog per account)
-- ============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  ncm TEXT,
  cest TEXT,
  cfop_default TEXT,
  unit TEXT DEFAULT 'UN',
  gtin TEXT,
  price_default NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_default NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, sku)
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INVENTORY (Stock per store)
-- ============================================
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty_on_hand NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, product_id)
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  address_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SALES
-- ============================================
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status public.sale_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SALE ITEMS
-- ============================================
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_line NUMERIC(12,2) NOT NULL
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  method public.payment_method NOT NULL,
  card_type public.card_type,
  brand TEXT,
  installments INT DEFAULT 1,
  card_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  card_fee_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SELLER COMMISSION RULES
-- ============================================
CREATE TABLE public.seller_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  percent_default NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, seller_user_id)
);
ALTER TABLE public.seller_commission_rules ENABLE ROW LEVEL SECURITY;

-- ============================================
-- COMMISSIONS
-- ============================================
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  percent NUMERIC(5,2) NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DRIVERS
-- ============================================
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DELIVERIES
-- ============================================
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  delivery_type public.delivery_type NOT NULL DEFAULT 'delivery',
  address_json JSONB,
  eta_minutes INT,
  eta_at TIMESTAMPTZ,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- NFE.IO SETTINGS (Per store)
-- ============================================
CREATE TABLE public.nfeio_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  environment public.nfeio_environment NOT NULL DEFAULT 'homolog',
  webhook_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);
ALTER TABLE public.nfeio_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FISCAL DOCUMENTS
-- ============================================
CREATE TABLE public.fiscal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type public.fiscal_doc_type NOT NULL,
  provider TEXT NOT NULL DEFAULT 'nfeio',
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  pdf_url TEXT,
  xml_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- WEBHOOK EVENTS
-- ============================================
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'nfeio',
  event_type TEXT,
  payload_json JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received'
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- IMPORT JOBS
-- ============================================
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.import_job_status NOT NULL DEFAULT 'pending',
  total_rows INT NOT NULL DEFAULT 0,
  success_rows INT NOT NULL DEFAULT 0,
  error_rows INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- IMPORT JOB ERRORS
-- ============================================
CREATE TABLE public.import_job_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  message TEXT NOT NULL,
  row_data_json JSONB
);
ALTER TABLE public.import_job_errors ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES (For user display info)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER FUNCTIONS (Avoid RLS recursion)
-- ============================================

-- Get user's account IDs
CREATE OR REPLACE FUNCTION public.get_user_account_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(account_id) FROM public.memberships WHERE user_id = _user_id AND is_active = true
$$;

-- Check if user has specific role in account
CREATE OR REPLACE FUNCTION public.has_account_role(_user_id UUID, _account_id UUID, _roles account_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships 
    WHERE user_id = _user_id 
      AND account_id = _account_id 
      AND role = ANY(_roles)
      AND is_active = true
  )
$$;

-- Check if user is member of account
CREATE OR REPLACE FUNCTION public.is_account_member(_user_id UUID, _account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships 
    WHERE user_id = _user_id 
      AND account_id = _account_id 
      AND is_active = true
  )
$$;

-- Get user's store IDs in an account
CREATE OR REPLACE FUNCTION public.get_user_store_ids(_user_id UUID, _account_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT s.id)
  FROM public.stores s
  LEFT JOIN public.store_memberships sm ON sm.store_id = s.id AND sm.user_id = _user_id
  LEFT JOIN public.memberships m ON m.account_id = s.account_id AND m.user_id = _user_id
  WHERE s.account_id = _account_id
    AND s.is_active = true
    AND (
      -- Owner/Admin/Manager see all stores
      m.role IN ('owner', 'admin', 'manager')
      OR
      -- Sellers only see stores they're assigned to
      (m.role = 'seller' AND sm.is_active = true)
    )
$$;

-- Get user role in account
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID, _account_id UUID)
RETURNS account_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.memberships 
  WHERE user_id = _user_id 
    AND account_id = _account_id 
    AND is_active = true
  LIMIT 1
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- ACCOUNTS: Users can see accounts where they have membership
CREATE POLICY "Users can view their accounts" ON public.accounts
  FOR SELECT USING (id = ANY(public.get_user_account_ids(auth.uid())));

CREATE POLICY "Users can insert accounts" ON public.accounts
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners can update accounts" ON public.accounts
  FOR UPDATE USING (public.has_account_role(auth.uid(), id, ARRAY['owner']::account_role[]));

-- MEMBERSHIPS: Users can view memberships in their accounts
CREATE POLICY "Users can view memberships" ON public.memberships
  FOR SELECT USING (account_id = ANY(public.get_user_account_ids(auth.uid())));

CREATE POLICY "Owners/admins can manage memberships" ON public.memberships
  FOR ALL USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin']::account_role[]));

-- STORES: Users can view stores in their accounts
CREATE POLICY "Users can view stores" ON public.stores
  FOR SELECT USING (account_id = ANY(public.get_user_account_ids(auth.uid())));

CREATE POLICY "Owners/admins can manage stores" ON public.stores
  FOR ALL USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin']::account_role[]));

-- STORE MEMBERSHIPS
CREATE POLICY "Users can view store memberships" ON public.store_memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_memberships.store_id
        AND s.account_id = ANY(public.get_user_account_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage store memberships" ON public.store_memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_memberships.store_id
        AND public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
    )
  );

-- PRODUCTS: All account members can view; admin/manager can manage
CREATE POLICY "Users can view products" ON public.products
  FOR SELECT USING (account_id = ANY(public.get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[]));

-- INVENTORY: All account members can view; admin/manager can manage
CREATE POLICY "Users can view inventory" ON public.inventory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = inventory.store_id
        AND s.account_id = ANY(public.get_user_account_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage inventory" ON public.inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = inventory.store_id
        AND public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
    )
  );

-- CUSTOMERS
CREATE POLICY "Users can view customers" ON public.customers
  FOR SELECT USING (account_id = ANY(public.get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage customers" ON public.customers
  FOR ALL USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[]));

-- SALES: Sellers see own sales; admin/manager see all
CREATE POLICY "Users can view sales" ON public.sales
  FOR SELECT USING (
    account_id = ANY(public.get_user_account_ids(auth.uid()))
    AND (
      seller_user_id = auth.uid()
      OR public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
    )
  );

CREATE POLICY "Users can insert sales" ON public.sales
  FOR INSERT WITH CHECK (
    account_id = ANY(public.get_user_account_ids(auth.uid()))
    AND seller_user_id = auth.uid()
  );

CREATE POLICY "Users can update own draft/open sales" ON public.sales
  FOR UPDATE USING (
    account_id = ANY(public.get_user_account_ids(auth.uid()))
    AND (
      (seller_user_id = auth.uid() AND status IN ('draft', 'open'))
      OR public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
    )
  );

-- SALE ITEMS
CREATE POLICY "Users can view sale items" ON public.sale_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.account_id = ANY(public.get_user_account_ids(auth.uid()))
        AND (
          s.seller_user_id = auth.uid()
          OR public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
        )
    )
  );

CREATE POLICY "Users can manage sale items" ON public.sale_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.account_id = ANY(public.get_user_account_ids(auth.uid()))
        AND (
          (s.seller_user_id = auth.uid() AND s.status IN ('draft', 'open'))
          OR public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
        )
    )
  );

-- PAYMENTS
CREATE POLICY "Users can view payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = payments.sale_id
        AND s.account_id = ANY(public.get_user_account_ids(auth.uid()))
        AND (
          s.seller_user_id = auth.uid()
          OR public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
        )
    )
  );

CREATE POLICY "Users can manage payments" ON public.payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = payments.sale_id
        AND s.account_id = ANY(public.get_user_account_ids(auth.uid()))
        AND (
          (s.seller_user_id = auth.uid() AND s.status IN ('draft', 'open'))
          OR public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
        )
    )
  );

-- SELLER COMMISSION RULES
CREATE POLICY "Admins can view commission rules" ON public.seller_commission_rules
  FOR SELECT USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[]));

CREATE POLICY "Admins can manage commission rules" ON public.seller_commission_rules
  FOR ALL USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin']::account_role[]));

-- COMMISSIONS
CREATE POLICY "Users can view commissions" ON public.commissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = commissions.sale_id
        AND s.account_id = ANY(public.get_user_account_ids(auth.uid()))
        AND (
          commissions.seller_user_id = auth.uid()
          OR public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
        )
    )
  );

CREATE POLICY "Admins can manage commissions" ON public.commissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = commissions.sale_id
        AND public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin']::account_role[])
    )
  );

-- DRIVERS
CREATE POLICY "Users can view drivers" ON public.drivers
  FOR SELECT USING (account_id = ANY(public.get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage drivers" ON public.drivers
  FOR ALL USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[]));

-- DELIVERIES
CREATE POLICY "Users can view deliveries" ON public.deliveries
  FOR SELECT USING (
    account_id = ANY(public.get_user_account_ids(auth.uid()))
    AND (
      EXISTS (SELECT 1 FROM public.sales s WHERE s.id = deliveries.sale_id AND s.seller_user_id = auth.uid())
      OR public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
    )
  );

CREATE POLICY "Admins can manage deliveries" ON public.deliveries
  FOR ALL USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[]));

-- NFEIO SETTINGS
CREATE POLICY "Admins can view nfeio settings" ON public.nfeio_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = nfeio_settings.store_id
        AND public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin']::account_role[])
    )
  );

CREATE POLICY "Admins can manage nfeio settings" ON public.nfeio_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = nfeio_settings.store_id
        AND public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin']::account_role[])
    )
  );

-- FISCAL DOCUMENTS
CREATE POLICY "Users can view fiscal documents" ON public.fiscal_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = fiscal_documents.sale_id
        AND s.account_id = ANY(public.get_user_account_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage fiscal documents" ON public.fiscal_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = fiscal_documents.store_id
        AND public.has_account_role(auth.uid(), s.account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
    )
  );

-- WEBHOOK EVENTS (admin only)
CREATE POLICY "Admins can view webhook events" ON public.webhook_events
  FOR SELECT USING (true); -- Filtered by context in app

-- IMPORT JOBS
CREATE POLICY "Users can view their import jobs" ON public.import_jobs
  FOR SELECT USING (
    account_id = ANY(public.get_user_account_ids(auth.uid()))
    AND public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
  );

CREATE POLICY "Admins can manage import jobs" ON public.import_jobs
  FOR ALL USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner', 'admin', 'manager']::account_role[]));

-- IMPORT JOB ERRORS
CREATE POLICY "Users can view import job errors" ON public.import_job_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.import_jobs j
      WHERE j.id = import_job_errors.job_id
        AND public.has_account_role(auth.uid(), j.account_id, ARRAY['owner', 'admin', 'manager']::account_role[])
    )
  );

-- PROFILES
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- TRIGGERS AND FUNCTIONS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create owner membership when account is created
CREATE OR REPLACE FUNCTION public.handle_new_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.memberships (account_id, user_id, role)
  VALUES (NEW.id, NEW.owner_user_id, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_account_created
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_account();

-- Recalculate sale totals
CREATE OR REPLACE FUNCTION public.recalculate_sale_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_subtotal NUMERIC(12,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_sale_id := OLD.sale_id;
  ELSE
    v_sale_id := NEW.sale_id;
  END IF;
  
  SELECT COALESCE(SUM(total_line), 0) INTO v_subtotal
  FROM public.sale_items WHERE sale_id = v_sale_id;
  
  UPDATE public.sales
  SET subtotal = v_subtotal,
      total = v_subtotal - COALESCE(discount, 0),
      updated_at = now()
  WHERE id = v_sale_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalc_sale_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_sale_totals();

-- Handle sale status change to 'paid'
CREATE OR REPLACE FUNCTION public.handle_sale_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commission_percent NUMERIC(5,2);
  v_commission_value NUMERIC(12,2);
  v_item RECORD;
BEGIN
  -- Only process when status changes TO 'paid'
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    -- 1. Decrease inventory for each item
    FOR v_item IN SELECT product_id, qty FROM public.sale_items WHERE sale_id = NEW.id
    LOOP
      UPDATE public.inventory
      SET qty_on_hand = qty_on_hand - v_item.qty,
          updated_at = now()
      WHERE store_id = NEW.store_id AND product_id = v_item.product_id;
      
      -- Create inventory record if not exists
      IF NOT FOUND THEN
        INSERT INTO public.inventory (store_id, product_id, qty_on_hand)
        VALUES (NEW.store_id, v_item.product_id, -v_item.qty);
      END IF;
    END LOOP;
    
    -- 2. Calculate card fees for card payments
    UPDATE public.payments
    SET card_fee_value = ROUND(paid_value * card_fee_percent / 100, 2)
    WHERE sale_id = NEW.id AND method = 'card';
    
    -- 3. Create commission for seller
    SELECT COALESCE(percent_default, 0) INTO v_commission_percent
    FROM public.seller_commission_rules
    WHERE account_id = NEW.account_id AND seller_user_id = NEW.seller_user_id AND is_active = true
    LIMIT 1;
    
    IF v_commission_percent > 0 THEN
      v_commission_value := ROUND(NEW.total * v_commission_percent / 100, 2);
      INSERT INTO public.commissions (sale_id, seller_user_id, percent, value, status)
      VALUES (NEW.id, NEW.seller_user_id, v_commission_percent, v_commission_value, 'pending');
    END IF;
    
    -- 4. Create delivery record
    INSERT INTO public.deliveries (sale_id, account_id, store_id, status, delivery_type)
    VALUES (NEW.id, NEW.account_id, NEW.store_id, 'pending', 'delivery');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_sale_paid
  AFTER UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_sale_paid();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_sales_timestamp
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_inventory_timestamp
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_deliveries_timestamp
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_timestamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();