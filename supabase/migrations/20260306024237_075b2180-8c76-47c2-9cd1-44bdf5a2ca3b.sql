
-- Return notes (notas de devolução) table
CREATE TABLE public.return_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  customer_id uuid REFERENCES public.customers(id),
  reason text NOT NULL DEFAULT '',
  total_refund numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'completed'
);

-- Return note items
CREATE TABLE public.return_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_note_id uuid NOT NULL REFERENCES public.return_notes(id) ON DELETE CASCADE,
  sale_item_id uuid REFERENCES public.sale_items(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total_line numeric(12,2) NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.return_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_note_items ENABLE ROW LEVEL SECURITY;

-- return_notes policies
CREATE POLICY "Users can view return notes"
  ON public.return_notes FOR SELECT
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Admins can manage return notes"
  ON public.return_notes FOR ALL
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role]));

-- return_note_items policies
CREATE POLICY "Users can view return note items"
  ON public.return_note_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.return_notes rn
    WHERE rn.id = return_note_items.return_note_id
    AND rn.account_id = ANY(get_user_account_ids(auth.uid()))
  ));

CREATE POLICY "Admins can manage return note items"
  ON public.return_note_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.return_notes rn
    WHERE rn.id = return_note_items.return_note_id
    AND has_account_role(auth.uid(), rn.account_id, ARRAY['owner'::account_role, 'admin'::account_role, 'manager'::account_role])
  ));
