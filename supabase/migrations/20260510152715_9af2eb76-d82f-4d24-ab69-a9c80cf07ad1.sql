ALTER TABLE public.uber_direct_global_credentials 
  ADD COLUMN IF NOT EXISTS webhook_signing_secret text;

COMMENT ON COLUMN public.uber_direct_global_credentials.webhook_signing_secret IS 'Secret used to validate x-uber-signature HMAC-SHA256 header on incoming webhooks.';