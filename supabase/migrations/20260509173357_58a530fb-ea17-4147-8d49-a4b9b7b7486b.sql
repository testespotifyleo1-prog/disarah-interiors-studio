
-- Adiciona memória de sessão, flag de escalação e anti-repetição ao chatbot
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS session_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_bot_phrases jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_escalated
  ON public.chat_conversations (escalated_at) WHERE escalated_at IS NOT NULL;
