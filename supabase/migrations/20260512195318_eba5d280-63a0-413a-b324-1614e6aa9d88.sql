CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trg_inventory_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account UUID;
  v_payload JSONB;
  v_previous_qty NUMERIC;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.qty_on_hand IS NOT DISTINCT FROM OLD.qty_on_hand THEN
    RETURN NEW;
  END IF;

  SELECT account_id INTO v_account FROM public.stores WHERE id = NEW.store_id;
  IF v_account IS NULL THEN
    RETURN NEW;
  END IF;

  v_previous_qty := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.qty_on_hand END;

  v_payload := jsonb_build_object(
    'store_id', NEW.store_id,
    'product_id', NEW.product_id,
    'variant_id', NEW.variant_id,
    'qty_on_hand', NEW.qty_on_hand,
    'previous_qty', v_previous_qty,
    'updated_at', NEW.updated_at
  );

  PERFORM public.enqueue_webhook_event(v_account, 'stock.changed', v_payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_webhook_update ON public.inventory;
DROP TRIGGER IF EXISTS inventory_webhook_insert ON public.inventory;

CREATE TRIGGER inventory_webhook_insert
AFTER INSERT ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.trg_inventory_webhook();

CREATE TRIGGER inventory_webhook_update
AFTER UPDATE OF qty_on_hand ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.trg_inventory_webhook();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'typos-webhook-dispatcher') THEN
    PERFORM cron.unschedule('typos-webhook-dispatcher');
  END IF;

  PERFORM cron.schedule(
    'typos-webhook-dispatcher',
    '* * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://ietaxjtvtrfxtrkjvcso.supabase.co/functions/v1/webhook-dispatcher',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
    $cron$
  );
END $$;