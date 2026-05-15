
-- ══════════════════════════════════════════════════════════════
-- STORE TRANSFERS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.store_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  transfer_number serial,
  from_store_id uuid NOT NULL REFERENCES public.stores(id),
  to_store_id uuid NOT NULL REFERENCES public.stores(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid NOT NULL,
  separated_by uuid,
  separated_at timestamptz,
  shipped_by uuid,
  shipped_at timestamptz,
  received_by uuid,
  received_at timestamptz,
  canceled_by uuid,
  canceled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.store_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.store_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  variant_id uuid REFERENCES public.product_variants(id),
  presentation_id uuid REFERENCES public.product_presentations(id),
  qty_requested numeric NOT NULL DEFAULT 0,
  qty_received numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.store_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage store_transfers" ON public.store_transfers FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Members can view store_transfers" ON public.store_transfers FOR SELECT
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Members can insert store_transfers" ON public.store_transfers FOR INSERT
  WITH CHECK (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage store_transfer_items" ON public.store_transfer_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.store_transfers t WHERE t.id = store_transfer_items.transfer_id AND has_account_role(auth.uid(), t.account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])));

CREATE POLICY "Members can view store_transfer_items" ON public.store_transfer_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.store_transfers t WHERE t.id = store_transfer_items.transfer_id AND t.account_id = ANY(get_user_account_ids(auth.uid()))));

CREATE POLICY "Members can insert store_transfer_items" ON public.store_transfer_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.store_transfers t WHERE t.id = store_transfer_items.transfer_id AND t.account_id = ANY(get_user_account_ids(auth.uid()))));

CREATE INDEX idx_store_transfers_account ON public.store_transfers(account_id);
CREATE INDEX idx_store_transfers_status ON public.store_transfers(status);
CREATE INDEX idx_store_transfer_items_transfer ON public.store_transfer_items(transfer_id);

-- ══════════════════════════════════════════════════════════════
-- PURCHASE ORDERS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  order_number serial,
  supplier_id uuid REFERENCES public.suppliers(id),
  store_id uuid REFERENCES public.stores(id),
  type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'draft',
  notes text,
  expected_delivery_date date,
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  ordered_at timestamptz,
  received_by uuid,
  received_at timestamptz,
  canceled_by uuid,
  canceled_at timestamptz,
  cancel_reason text,
  subtotal numeric NOT NULL DEFAULT 0,
  total_freight numeric NOT NULL DEFAULT 0,
  total_discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  variant_id uuid REFERENCES public.product_variants(id),
  presentation_id uuid REFERENCES public.product_presentations(id),
  qty_ordered numeric NOT NULL DEFAULT 0,
  qty_received numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_line numeric NOT NULL DEFAULT 0,
  notes text
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage purchase_orders" ON public.purchase_orders FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Members can view purchase_orders" ON public.purchase_orders FOR SELECT
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage purchase_order_items" ON public.purchase_order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id AND has_account_role(auth.uid(), po.account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])));

CREATE POLICY "Members can view purchase_order_items" ON public.purchase_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id AND po.account_id = ANY(get_user_account_ids(auth.uid()))));

CREATE INDEX idx_purchase_orders_account ON public.purchase_orders(account_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_order_items_po ON public.purchase_order_items(purchase_order_id);

-- ══════════════════════════════════════════════════════════════
-- QUOTES (Orçamento/Pré-venda)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  quote_number serial,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  customer_id uuid REFERENCES public.customers(id),
  seller_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  valid_until date,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  converted_sale_id uuid REFERENCES public.sales(id),
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  variant_id uuid REFERENCES public.product_variants(id),
  presentation_id uuid REFERENCES public.product_presentations(id),
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total_line numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quotes" ON public.quotes FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

CREATE POLICY "Sellers can view own quotes" ON public.quotes FOR SELECT
  USING (account_id = ANY(get_user_account_ids(auth.uid())) AND (seller_user_id = auth.uid() OR has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])));

CREATE POLICY "Sellers can create quotes" ON public.quotes FOR INSERT
  WITH CHECK (account_id = ANY(get_user_account_ids(auth.uid())) AND seller_user_id = auth.uid());

CREATE POLICY "Sellers can update own quotes" ON public.quotes FOR UPDATE
  USING (account_id = ANY(get_user_account_ids(auth.uid())) AND (seller_user_id = auth.uid() OR has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])));

CREATE POLICY "Admins can manage quote_items" ON public.quote_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND has_account_role(auth.uid(), q.account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])));

CREATE POLICY "Members can view quote_items" ON public.quote_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.account_id = ANY(get_user_account_ids(auth.uid()))));

CREATE POLICY "Sellers can insert quote_items" ON public.quote_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.account_id = ANY(get_user_account_ids(auth.uid()))));

CREATE POLICY "Sellers can update quote_items" ON public.quote_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.account_id = ANY(get_user_account_ids(auth.uid()))));

CREATE POLICY "Sellers can delete quote_items" ON public.quote_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.account_id = ANY(get_user_account_ids(auth.uid()))));

CREATE INDEX idx_quotes_account ON public.quotes(account_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_customer ON public.quotes(customer_id);
CREATE INDEX idx_quotes_seller ON public.quotes(seller_user_id);
CREATE INDEX idx_quote_items_quote ON public.quote_items(quote_id);

-- Triggers for updated_at
CREATE TRIGGER update_store_transfers_updated_at BEFORE UPDATE ON public.store_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
