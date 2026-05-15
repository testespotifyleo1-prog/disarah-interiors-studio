
CREATE TABLE IF NOT EXISTS public.support_action_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  match_categories text[] NOT NULL DEFAULT '{}',
  match_priorities text[] NOT NULL DEFAULT '{}',
  match_statuses text[] NOT NULL DEFAULT ARRAY['open','in_progress'],
  keywords text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('low','normal','high','urgent')),
  require_unread boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_action_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage action rules"
  ON public.support_action_rules
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Authenticated can read action rules"
  ON public.support_action_rules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_support_action_rules_updated_at
  BEFORE UPDATE ON public.support_action_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add tags column to support_tickets so rules can match arbitrary tags
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
