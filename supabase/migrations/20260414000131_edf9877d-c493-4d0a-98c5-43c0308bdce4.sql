
-- Create sequence for ticket numbers
CREATE SEQUENCE public.support_ticket_number_seq START 1000;

-- Support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number INTEGER NOT NULL DEFAULT nextval('public.support_ticket_number_seq'),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id),
  created_by UUID NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Support messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_name TEXT,
  sender_type TEXT NOT NULL DEFAULT 'client',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_support_tickets_account ON public.support_tickets(account_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id);

-- RLS for support_tickets
CREATE POLICY "Admins can create tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role])
  );

CREATE POLICY "Account members can view their tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (
    has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role])
    OR is_super_admin()
  );

CREATE POLICY "Super admins can update any ticket"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (
    is_super_admin()
    OR has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role])
  );

-- RLS for support_messages
CREATE POLICY "Users can view messages of their tickets"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
      AND (
        has_account_role(auth.uid(), t.account_id, ARRAY['owner'::account_role, 'admin'::account_role])
        OR is_super_admin()
      )
    )
  );

CREATE POLICY "Users can send messages to their tickets"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
      AND (
        has_account_role(auth.uid(), t.account_id, ARRAY['owner'::account_role, 'admin'::account_role])
        OR is_super_admin()
      )
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
