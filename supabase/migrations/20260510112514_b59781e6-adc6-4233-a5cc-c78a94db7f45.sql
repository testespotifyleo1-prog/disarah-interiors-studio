
-- ============================================
-- GLOBAL CREDENTIALS (Super Admin only)
-- ============================================

CREATE TABLE public.amazon_global_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lwa_client_id TEXT NOT NULL,
  lwa_client_secret TEXT NOT NULL,
  aws_region TEXT NOT NULL DEFAULT 'us-east-1',
  marketplace_id TEXT NOT NULL DEFAULT 'A2Q3Y263D00KWC',
  app_id TEXT,
  is_sandbox BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.magalu_global_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  api_base_url TEXT NOT NULL DEFAULT 'https://api.magalu.com',
  is_sandbox BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.melhor_envio_global_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  is_sandbox BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.uber_direct_global_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  is_sandbox BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PER-MERCHANT CONNECTIONS
-- ============================================

CREATE TABLE public.amazon_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  seller_id TEXT,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  marketplace_ids TEXT[] DEFAULT ARRAY['A2Q3Y263D00KWC'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amazon_connections_account ON public.amazon_connections(account_id);

CREATE TABLE public.magalu_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  seller_id TEXT,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_magalu_connections_account ON public.magalu_connections(account_id);

CREATE TABLE public.melhor_envio_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  enabled_carriers JSONB NOT NULL DEFAULT '["correios_pac","correios_sedex","jadlog","loggi"]'::jsonb,
  origin_zipcode TEXT,
  default_weight_grams INTEGER DEFAULT 500,
  default_length_cm INTEGER DEFAULT 20,
  default_width_cm INTEGER DEFAULT 15,
  default_height_cm INTEGER DEFAULT 10,
  markup_percent NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_melhor_envio_connections_account ON public.melhor_envio_connections(account_id);

CREATE TABLE public.uber_direct_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  pickup_address JSONB NOT NULL,
  max_delivery_radius_km INTEGER DEFAULT 15,
  max_weight_kg NUMERIC(5,2) DEFAULT 30,
  operating_hours JSONB DEFAULT '{"start":"08:00","end":"22:00"}'::jsonb,
  external_store_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_uber_direct_connections_account ON public.uber_direct_connections(account_id);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE TRIGGER trg_amazon_global_updated BEFORE UPDATE ON public.amazon_global_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_magalu_global_updated BEFORE UPDATE ON public.magalu_global_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_melhor_envio_global_updated BEFORE UPDATE ON public.melhor_envio_global_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uber_direct_global_updated BEFORE UPDATE ON public.uber_direct_global_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_amazon_conn_updated BEFORE UPDATE ON public.amazon_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_magalu_conn_updated BEFORE UPDATE ON public.magalu_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_me_conn_updated BEFORE UPDATE ON public.melhor_envio_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uber_conn_updated BEFORE UPDATE ON public.uber_direct_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.amazon_global_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magalu_global_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.melhor_envio_global_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uber_direct_global_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amazon_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magalu_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.melhor_envio_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uber_direct_connections ENABLE ROW LEVEL SECURITY;

-- Globals: super admin only
CREATE POLICY "super_admin_all" ON public.amazon_global_credentials FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "super_admin_all" ON public.magalu_global_credentials FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "super_admin_all" ON public.melhor_envio_global_credentials FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "super_admin_all" ON public.uber_direct_global_credentials FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Connections: account members (owner/admin) manage their own
CREATE POLICY "members_manage_amazon" ON public.amazon_connections FOR ALL
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]))
  WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]));

CREATE POLICY "members_manage_magalu" ON public.magalu_connections FOR ALL
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]))
  WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]));

CREATE POLICY "members_manage_me" ON public.melhor_envio_connections FOR ALL
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]))
  WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]));

CREATE POLICY "members_manage_uber" ON public.uber_direct_connections FOR ALL
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]))
  WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role,'admin'::account_role]));
