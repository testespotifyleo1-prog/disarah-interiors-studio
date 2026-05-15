
-- 1. Add scheduled delivery fields to deliveries
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time text;

-- 2. Add delivery_days to suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS delivery_days integer DEFAULT 5;

-- 3. Commission tiers table
CREATE TABLE public.commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL,
  tier_type text NOT NULL DEFAULT 'per_sale' CHECK (tier_type IN ('per_sale', 'monthly_accumulated')),
  min_value numeric(12,2) NOT NULL DEFAULT 0,
  max_value numeric(12,2),
  percent numeric(5,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission tiers"
  ON public.commission_tiers FOR ALL TO authenticated
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]));

CREATE POLICY "Users can view commission tiers"
  ON public.commission_tiers FOR SELECT TO authenticated
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

-- 4. Chatbot settings per store
CREATE TABLE public.chatbot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  greeting_message text DEFAULT 'Olá! 👋 Sou o assistente virtual. Como posso ajudar?',
  ai_instructions text DEFAULT 'Você é um assistente de vendas amigável e informal. Ajude os clientes a encontrar produtos.',
  away_message text DEFAULT 'No momento estamos fora do horário de atendimento. Retornaremos em breve!',
  business_hours_start time DEFAULT '08:00',
  business_hours_end time DEFAULT '18:00',
  business_days integer[] DEFAULT ARRAY[1,2,3,4,5],
  z_api_instance_id text,
  z_api_instance_token text,
  z_api_client_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

ALTER TABLE public.chatbot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage chatbot settings"
  ON public.chatbot_settings FOR ALL TO authenticated
  USING (has_account_role(auth.uid(), account_id, ARRAY['owner'::account_role, 'admin'::account_role]));

CREATE POLICY "Users can view chatbot settings"
  ON public.chatbot_settings FOR SELECT TO authenticated
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

-- 5. Chat conversations
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  phone text NOT NULL,
  customer_name text,
  customer_id uuid REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'transferred')),
  is_ai_active boolean NOT NULL DEFAULT true,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage conversations"
  ON public.chat_conversations FOR ALL TO authenticated
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

CREATE POLICY "Users can view conversations"
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (account_id = ANY(get_user_account_ids(auth.uid())));

-- 6. Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'ai_response')),
  z_api_message_id text,
  is_ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage messages"
  ON public.chat_messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = chat_messages.conversation_id
    AND cc.account_id = ANY(get_user_account_ids(auth.uid()))
  ));

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
