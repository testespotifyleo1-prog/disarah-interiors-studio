-- 1. PICKING / EXPEDIÇÃO
CREATE TABLE IF NOT EXISTS public.picking_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  picker_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  shipping_provider text,
  shipping_label_url text,
  tracking_code text,
  notes text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_picking_orders_store_status ON public.picking_orders(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picking_orders_sale ON public.picking_orders(sale_id);

CREATE TABLE IF NOT EXISTS public.picking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  picking_order_id uuid NOT NULL REFERENCES public.picking_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  sku text, barcode text,
  qty_required numeric NOT NULL DEFAULT 1,
  qty_picked numeric NOT NULL DEFAULT 0,
  picked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_picking_items_order ON public.picking_items(picking_order_id);
CREATE INDEX IF NOT EXISTS idx_picking_items_barcode ON public.picking_items(barcode);

ALTER TABLE public.picking_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picking_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage picking_orders" ON public.picking_orders FOR ALL
USING (EXISTS (SELECT 1 FROM public.store_memberships sm WHERE sm.store_id = picking_orders.store_id AND sm.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.store_memberships sm WHERE sm.store_id = picking_orders.store_id AND sm.user_id = auth.uid()));

CREATE POLICY "Members manage picking_items" ON public.picking_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.picking_orders po JOIN public.store_memberships sm ON sm.store_id = po.store_id WHERE po.id = picking_items.picking_order_id AND sm.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.picking_orders po JOIN public.store_memberships sm ON sm.store_id = po.store_id WHERE po.id = picking_items.picking_order_id AND sm.user_id = auth.uid()));

-- 2. CUSTOMER RETURNS
CREATE TABLE IF NOT EXISTS public.customer_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  return_type text NOT NULL DEFAULT 'exchange',
  status text NOT NULL DEFAULT 'requested',
  reason text NOT NULL,
  photos jsonb DEFAULT '[]'::jsonb,
  resolution_notes text,
  warranty_until date,
  store_credit_id uuid REFERENCES public.store_credits(id) ON DELETE SET NULL,
  return_note_id uuid REFERENCES public.return_notes(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_returns_store_status ON public.customer_returns(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_returns_customer ON public.customer_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_sale ON public.customer_returns(sale_id);
ALTER TABLE public.customer_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage customer_returns" ON public.customer_returns FOR ALL
USING (EXISTS (SELECT 1 FROM public.store_memberships sm WHERE sm.store_id = customer_returns.store_id AND sm.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.store_memberships sm WHERE sm.store_id = customer_returns.store_id AND sm.user_id = auth.uid()));

-- 3. SALES GOALS
CREATE TABLE IF NOT EXISTS public.sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_user_id uuid,
  scope text NOT NULL DEFAULT 'store',
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  bonus_amount numeric NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_goals_account_period ON public.sales_goals(account_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_sales_goals_seller ON public.sales_goals(seller_user_id, period_start DESC);
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members view goals" ON public.sales_goals FOR SELECT
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.account_id = sales_goals.account_id AND m.user_id = auth.uid()));
CREATE POLICY "Owners/admins manage goals" ON public.sales_goals FOR ALL
USING (has_account_role(auth.uid(), sales_goals.account_id, ARRAY['owner'::account_role,'admin'::account_role]))
WITH CHECK (has_account_role(auth.uid(), sales_goals.account_id, ARRAY['owner'::account_role,'admin'::account_role]));

CREATE OR REPLACE VIEW public.sales_goals_progress AS
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

-- 4. REACTIVATION
CREATE TABLE IF NOT EXISTS public.reactivation_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  inactive_days int NOT NULL DEFAULT 90,
  message_template text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reactivation_account ON public.reactivation_campaigns(account_id, active);

CREATE TABLE IF NOT EXISTS public.reactivation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.reactivation_campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'sent'
);
CREATE INDEX IF NOT EXISTS idx_reactivation_log_customer ON public.reactivation_log(customer_id, sent_at DESC);

ALTER TABLE public.reactivation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactivation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners/admins manage reactivation" ON public.reactivation_campaigns FOR ALL
USING (has_account_role(auth.uid(), reactivation_campaigns.account_id, ARRAY['owner'::account_role,'admin'::account_role]))
WITH CHECK (has_account_role(auth.uid(), reactivation_campaigns.account_id, ARRAY['owner'::account_role,'admin'::account_role]));
CREATE POLICY "Members view reactivation log" ON public.reactivation_log FOR SELECT
USING (EXISTS (SELECT 1 FROM public.reactivation_campaigns c JOIN public.memberships m ON m.account_id = c.account_id AND m.user_id = auth.uid() WHERE c.id = reactivation_log.campaign_id));
CREATE POLICY "Members insert reactivation log" ON public.reactivation_log FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.reactivation_campaigns c JOIN public.memberships m ON m.account_id = c.account_id AND m.user_id = auth.uid() WHERE c.id = reactivation_log.campaign_id));

-- updated_at triggers using existing public.update_updated_at()
CREATE TRIGGER trg_picking_orders_updated BEFORE UPDATE ON public.picking_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_customer_returns_updated BEFORE UPDATE ON public.customer_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_sales_goals_updated BEFORE UPDATE ON public.sales_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_reactivation_campaigns_updated BEFORE UPDATE ON public.reactivation_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();