
-- 1. environment em api_keys
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'live'
  CHECK (environment IN ('live','test'));

CREATE INDEX IF NOT EXISTS idx_api_keys_account_env ON public.api_keys(account_id, environment);

-- 2. is_test em webhook_endpoints
ALTER TABLE public.webhook_endpoints
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 3. api_request_logs
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'live',
  method text NOT NULL,
  path text NOT NULL,
  query_params jsonb,
  status_code int NOT NULL,
  latency_ms int NOT NULL DEFAULT 0,
  ip text,
  user_agent text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_account_created ON public.api_request_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_key_created ON public.api_request_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON public.api_request_logs(account_id, status_code, created_at DESC);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_admins_view_api_logs" ON public.api_request_logs;
CREATE POLICY "owners_admins_view_api_logs" ON public.api_request_logs
  FOR SELECT TO authenticated
  USING (public.has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]));

-- Sem policies de INSERT — apenas service role (edge function) escreve.

-- 4. RPC de stats agregadas
CREATE OR REPLACE FUNCTION public.get_api_usage_stats(
  _account_id uuid,
  _from timestamptz,
  _to timestamptz,
  _environment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_totals jsonb;
  v_by_day jsonb;
  v_top_endpoints jsonb;
  v_top_keys jsonb;
BEGIN
  IF NOT public.has_account_role(auth.uid(), _account_id, ARRAY['owner'::account_role, 'admin'::account_role]) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  WITH base AS (
    SELECT * FROM public.api_request_logs
    WHERE account_id = _account_id
      AND created_at >= _from
      AND created_at <= _to
      AND (_environment IS NULL OR environment = _environment)
  )
  SELECT jsonb_build_object(
    'total_calls', COUNT(*),
    'errors', COUNT(*) FILTER (WHERE status_code >= 400),
    'avg_latency_ms', COALESCE(ROUND(AVG(latency_ms)::numeric, 0), 0),
    'p95_latency_ms', COALESCE(ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 0), 0)
  ) INTO v_totals FROM base;

  WITH base AS (
    SELECT * FROM public.api_request_logs
    WHERE account_id = _account_id AND created_at >= _from AND created_at <= _to
      AND (_environment IS NULL OR environment = _environment)
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_by_day FROM (
    SELECT date_trunc('day', created_at)::date AS day,
           COUNT(*) FILTER (WHERE status_code < 400) AS ok,
           COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) AS client_err,
           COUNT(*) FILTER (WHERE status_code >= 500) AS server_err
    FROM base GROUP BY 1 ORDER BY 1
  ) t;

  WITH base AS (
    SELECT * FROM public.api_request_logs
    WHERE account_id = _account_id AND created_at >= _from AND created_at <= _to
      AND (_environment IS NULL OR environment = _environment)
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_endpoints FROM (
    SELECT method || ' ' || path AS endpoint, COUNT(*) AS calls
    FROM base GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ) t;

  WITH base AS (
    SELECT l.*, k.name AS key_name, k.key_prefix
    FROM public.api_request_logs l
    LEFT JOIN public.api_keys k ON k.id = l.api_key_id
    WHERE l.account_id = _account_id AND l.created_at >= _from AND l.created_at <= _to
      AND (_environment IS NULL OR l.environment = _environment)
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_keys FROM (
    SELECT key_name, key_prefix, environment, COUNT(*) AS calls
    FROM base GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 5
  ) t;

  v_result := jsonb_build_object(
    'totals', COALESCE(v_totals, '{}'::jsonb),
    'by_day', v_by_day,
    'top_endpoints', v_top_endpoints,
    'top_keys', v_top_keys
  );
  RETURN v_result;
END;
$$;

-- 5. Cron de retenção (30 dias) — usa pg_cron se disponível
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-api-request-logs')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-api-request-logs');
    PERFORM cron.schedule(
      'purge-api-request-logs',
      '0 3 * * *',
      $cron$ DELETE FROM public.api_request_logs WHERE created_at < now() - interval '30 days' $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
