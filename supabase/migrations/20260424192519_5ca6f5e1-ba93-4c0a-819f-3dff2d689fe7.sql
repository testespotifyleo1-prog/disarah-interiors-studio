
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS profile_pic_url text,
  ADD COLUMN IF NOT EXISTS customer_pushname text,
  ADD COLUMN IF NOT EXISTS profile_fetched_at timestamptz;

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','image','document','audio','ai_response','sticker','video','ptt']));

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat-media public read" ON storage.objects;
CREATE POLICY "chat-media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat-media authenticated upload" ON storage.objects;
CREATE POLICY "chat-media authenticated upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat-media authenticated update" ON storage.objects;
CREATE POLICY "chat-media authenticated update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat-media authenticated delete" ON storage.objects;
CREATE POLICY "chat-media authenticated delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'chat-media');
