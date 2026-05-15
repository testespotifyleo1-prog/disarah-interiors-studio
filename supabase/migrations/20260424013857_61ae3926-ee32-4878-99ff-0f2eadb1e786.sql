-- 1. Conexão da conta vendedor Shopee (uma por loja)
CREATE TABLE public.shopee_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shop_id TEXT,
  shop_name TEXT,
  region TEXT NOT NULL DEFAULT 'BR',
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'disconnected', -- disconnected | connected | expired | error
  last_sync_at TIMESTAMPTZ,
  is_mock BOOLEAN NOT NULL DEFAULT true,
  connected_by UUID,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);

CREATE INDEX idx_shopee_connections_account ON public.shopee_connections(account_id);

ALTER TABLE public.shopee_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view shopee connections"
ON public.shopee_connections FOR SELECT
USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins manage shopee connections"
ON public.shopee_connections FOR ALL
USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]))
WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE TRIGGER trg_shopee_connections_updated_at
BEFORE UPDATE ON public.shopee_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Produtos selecionados pelo admin para vender na Shopee
CREATE TABLE public.shopee_product_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.shopee_connections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shopee_item_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending', -- pending | publishing | published | error | paused
  sync_error TEXT,
  shopee_price NUMERIC(12,2),
  include_variants BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, product_id)
);

CREATE INDEX idx_shopee_links_connection ON public.shopee_product_links(connection_id);
CREATE INDEX idx_shopee_links_product ON public.shopee_product_links(product_id);
CREATE INDEX idx_shopee_links_status ON public.shopee_product_links(sync_status);

ALTER TABLE public.shopee_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view shopee product links"
ON public.shopee_product_links FOR SELECT
USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins manage shopee product links"
ON public.shopee_product_links FOR ALL
USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]))
WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE TRIGGER trg_shopee_product_links_updated_at
BEFORE UPDATE ON public.shopee_product_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Pedidos Shopee recebidos
CREATE TABLE public.shopee_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.shopee_connections(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shopee_order_sn TEXT NOT NULL,
  buyer_name TEXT,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  shopee_status TEXT,
  payload_json JSONB,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, shopee_order_sn)
);

CREATE INDEX idx_shopee_orders_account ON public.shopee_orders(account_id);
CREATE INDEX idx_shopee_orders_connection ON public.shopee_orders(connection_id);

ALTER TABLE public.shopee_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view shopee orders"
ON public.shopee_orders FOR SELECT
USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins manage shopee orders"
ON public.shopee_orders FOR ALL
USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]))
WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));