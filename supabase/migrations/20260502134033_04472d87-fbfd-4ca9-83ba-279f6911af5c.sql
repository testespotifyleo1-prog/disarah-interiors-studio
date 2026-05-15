
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent';

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS is_typing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS typing_at timestamptz;
