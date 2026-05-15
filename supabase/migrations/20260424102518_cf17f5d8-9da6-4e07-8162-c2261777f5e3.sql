-- ============================================================
-- Mercado Livre integration tables (mirrors shopee_*)
-- ============================================================

-- 1) Connections (one per store)
CREATE TABLE public.meli_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  meli_user_id text,
  nickname text,
  site_id text NOT NULL DEFAULT 'MLB',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'disconnected',
  last_sync_at timestamptz,
  is_mock boolean NOT NULL DEFAULT true,
  connected_by uuid,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meli_connections_account ON public.meli_connections(account_id);

ALTER TABLE public.meli_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view meli connections"
  ON public.meli_connections
  FOR SELECT
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins manage meli connections"
  ON public.meli_connections
  FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]))
  WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE TRIGGER trg_meli_connections_updated_at
  BEFORE UPDATE ON public.meli_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Product links (one per product per connection)
CREATE TABLE public.meli_product_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.meli_connections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  meli_item_id text,
  sync_status text NOT NULL DEFAULT 'pending',
  sync_error text,
  meli_price numeric(12,2),
  include_variants boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, product_id)
);

CREATE INDEX idx_meli_links_connection ON public.meli_product_links(connection_id);
CREATE INDEX idx_meli_links_product ON public.meli_product_links(product_id);
CREATE INDEX idx_meli_links_status ON public.meli_product_links(sync_status);

ALTER TABLE public.meli_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view meli product links"
  ON public.meli_product_links
  FOR SELECT
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins manage meli product links"
  ON public.meli_product_links
  FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]))
  WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE TRIGGER trg_meli_product_links_updated_at
  BEFORE UPDATE ON public.meli_product_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3) Orders (incoming from Mercado Livre)
CREATE TABLE public.meli_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.meli_connections(id) ON DELETE CASCADE,
  meli_order_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  buyer_nickname text,
  payload_json jsonb,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, meli_order_id)
);

CREATE INDEX idx_meli_orders_account ON public.meli_orders(account_id);
CREATE INDEX idx_meli_orders_connection ON public.meli_orders(connection_id);
CREATE INDEX idx_meli_orders_status ON public.meli_orders(status);

ALTER TABLE public.meli_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view meli orders"
  ON public.meli_orders
  FOR SELECT
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins manage meli orders"
  ON public.meli_orders
  FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]))
  WITH CHECK (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE TRIGGER trg_meli_orders_updated_at
  BEFORE UPDATE ON public.meli_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();