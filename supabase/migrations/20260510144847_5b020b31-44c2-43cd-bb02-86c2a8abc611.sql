CREATE UNIQUE INDEX IF NOT EXISTS chatbot_settings_active_instance_unique
  ON public.chatbot_settings (z_api_instance_id)
  WHERE is_active = true AND z_api_instance_id IS NOT NULL AND TRIM(z_api_instance_id) <> '';