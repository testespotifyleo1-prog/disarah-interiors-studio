ALTER TABLE public.magalu_global_credentials 
  ADD COLUMN IF NOT EXISTS scope text;
COMMENT ON COLUMN public.magalu_global_credentials.scope IS 'OAuth scope string aprovado pela Magalu (ex.: "openid offline_access marketplace")';