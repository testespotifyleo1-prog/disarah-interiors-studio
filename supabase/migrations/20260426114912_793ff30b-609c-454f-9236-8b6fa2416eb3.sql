UPDATE public.chat_conversations
SET is_ai_active = true
WHERE is_ai_active = false
  AND last_message_at >= now() - interval '30 days';