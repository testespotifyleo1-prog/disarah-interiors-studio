
-- ============================================================
-- API PÚBLICA — Fase 1
-- ============================================================

-- 1) API KEYS
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_by UUID,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account ON public.api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins manage api keys" ON public.api_keys
FOR ALL
USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]))
WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]));

CREATE TRIGGER api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) WEBHOOK ENDPOINTS
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_account ON public.webhook_endpoints(account_id);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins manage webhooks" ON public.webhook_endpoints
FOR ALL
USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]))
WITH CHECK (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]));

CREATE TRIGGER webhook_endpoints_updated_at
BEFORE UPDATE ON public.webhook_endpoints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) WEBHOOK DELIVERIES (outbox + log)
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  endpoint_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INT,
  response_body TEXT,
  attempt INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
  ON public.webhook_deliveries(next_attempt_at)
  WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
  ON public.webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_account
  ON public.webhook_deliveries(account_id, created_at DESC);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins read deliveries" ON public.webhook_deliveries
FOR SELECT
USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]));

-- 4) REVOKE API KEY RPC
CREATE OR REPLACE FUNCTION public.revoke_api_key(_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account UUID;
BEGIN
  SELECT account_id INTO v_account FROM public.api_keys WHERE id = _id;
  IF v_account IS NULL THEN RAISE EXCEPTION 'API key not found'; END IF;
  IF NOT public.has_account_role(auth.uid(), v_account, ARRAY['owner'::account_role, 'admin'::account_role]) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.api_keys SET revoked_at = now(), updated_at = now() WHERE id = _id;
END;
$$;

-- 5) ENQUEUE WEBHOOK EVENT
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  _account_id UUID,
  _event TEXT,
  _payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.webhook_endpoints
    WHERE account_id = _account_id
      AND is_active = true
      AND _event = ANY(events)
  LOOP
    INSERT INTO public.webhook_deliveries (account_id, endpoint_id, event, payload)
    VALUES (_account_id, r.id, _event, _payload);
  END LOOP;
END;
$$;

-- 6) TRIGGERS em sales
CREATE OR REPLACE FUNCTION public.trg_sales_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_event TEXT; v_payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'sale.created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;
    IF NEW.status = 'paid' THEN v_event := 'sale.paid';
    ELSIF NEW.status = 'canceled' THEN v_event := 'sale.canceled';
    ELSE RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'id', NEW.id,
    'order_number', NEW.order_number,
    'account_id', NEW.account_id,
    'store_id', NEW.store_id,
    'customer_id', NEW.customer_id,
    'status', NEW.status,
    'total', NEW.total,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  PERFORM public.enqueue_webhook_event(NEW.account_id, v_event, v_payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_webhook_insert ON public.sales;
CREATE TRIGGER sales_webhook_insert
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.trg_sales_webhook();

DROP TRIGGER IF EXISTS sales_webhook_update ON public.sales;
CREATE TRIGGER sales_webhook_update
AFTER UPDATE OF status ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.trg_sales_webhook();

-- 7) TRIGGER em inventory
CREATE OR REPLACE FUNCTION public.trg_inventory_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account UUID; v_payload JSONB;
BEGIN
  IF NEW.qty_on_hand = OLD.qty_on_hand THEN RETURN NEW; END IF;
  SELECT account_id INTO v_account FROM public.stores WHERE id = NEW.store_id;
  IF v_account IS NULL THEN RETURN NEW; END IF;

  v_payload := jsonb_build_object(
    'store_id', NEW.store_id,
    'product_id', NEW.product_id,
    'qty_on_hand', NEW.qty_on_hand,
    'previous_qty', OLD.qty_on_hand,
    'updated_at', NEW.updated_at
  );

  PERFORM public.enqueue_webhook_event(v_account, 'stock.changed', v_payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_webhook_update ON public.inventory;
CREATE TRIGGER inventory_webhook_update
AFTER UPDATE OF qty_on_hand ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.trg_inventory_webhook();
