
CREATE TABLE IF NOT EXISTS public.support_action_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.support_action_rules(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  severity text NOT NULL DEFAULT 'normal',
  reason text,
  matched_keywords text[] NOT NULL DEFAULT '{}',
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS support_action_alerts_unique_open
  ON public.support_action_alerts (ticket_id, rule_id)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS support_action_alerts_ticket_idx ON public.support_action_alerts (ticket_id);
CREATE INDEX IF NOT EXISTS support_action_alerts_account_idx ON public.support_action_alerts (account_id);
CREATE INDEX IF NOT EXISTS support_action_alerts_open_idx ON public.support_action_alerts (acknowledged_at) WHERE acknowledged_at IS NULL;

ALTER TABLE public.support_action_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage alerts"
  ON public.support_action_alerts
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Account members read own alerts"
  ON public.support_action_alerts
  FOR SELECT TO authenticated
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]));

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_action_alerts;

CREATE OR REPLACE FUNCTION public.acknowledge_support_action_alert(_alert_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin() THEN
    UPDATE public.support_action_alerts
       SET acknowledged_at = now(), acknowledged_by = auth.uid()
     WHERE id = _alert_id AND acknowledged_at IS NULL;
  ELSE
    UPDATE public.support_action_alerts
       SET acknowledged_at = now(), acknowledged_by = auth.uid()
     WHERE id = _alert_id
       AND acknowledged_at IS NULL
       AND public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]);
  END IF;
END;
$$;
