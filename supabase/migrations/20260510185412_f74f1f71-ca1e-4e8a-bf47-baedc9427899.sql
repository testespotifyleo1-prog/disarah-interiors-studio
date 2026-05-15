ALTER TABLE public.chatbot_settings
ADD COLUMN IF NOT EXISTS tracking_message_template text
DEFAULT 'Olá {nome_cliente}! 📦 Acompanhe seu pedido #{numero_pedido} em tempo real: {link_rastreio}';