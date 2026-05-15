
-- Add media_url to chat_messages for storing image/audio URLs
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS media_url text;

-- Add sale_id to chat_conversations for linking to sales
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id);
