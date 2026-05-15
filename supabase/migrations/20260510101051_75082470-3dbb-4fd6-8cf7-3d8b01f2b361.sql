
-- Unread counters per side
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS client_unread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS support_unread_count integer NOT NULL DEFAULT 0;

-- Trigger: when a new message arrives, increment counter on the OPPOSITE side
CREATE OR REPLACE FUNCTION public.support_message_increment_unread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sender_type = 'support' THEN
    UPDATE public.support_tickets
       SET client_unread_count = client_unread_count + 1,
           last_message_at = now()
     WHERE id = NEW.ticket_id;
  ELSE
    UPDATE public.support_tickets
       SET support_unread_count = support_unread_count + 1,
           last_message_at = now()
     WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_message_increment_unread_trg ON public.support_messages;
CREATE TRIGGER support_message_increment_unread_trg
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_message_increment_unread();

-- Helper RPC: mark ticket as read for the calling user (decides side automatically)
CREATE OR REPLACE FUNCTION public.mark_support_ticket_read(_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_super_admin() THEN
    UPDATE public.support_tickets SET support_unread_count = 0 WHERE id = _ticket_id;
  ELSE
    UPDATE public.support_tickets SET client_unread_count = 0
     WHERE id = _ticket_id
       AND public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_support_ticket_read(uuid) TO authenticated;

-- Make sure realtime broadcasts ticket updates so the bell refreshes in real time
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_tickets';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets';
  END IF;
END $$;
