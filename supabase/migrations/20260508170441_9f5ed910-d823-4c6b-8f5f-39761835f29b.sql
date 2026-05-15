
ALTER TABLE public.chatbot_settings
  ADD COLUMN IF NOT EXISTS business_info text,
  ADD COLUMN IF NOT EXISTS tone text DEFAULT 'amigavel_objetivo',
  ADD COLUMN IF NOT EXISTS faq text,
  ADD COLUMN IF NOT EXISTS response_examples text,
  ADD COLUMN IF NOT EXISTS forbidden_topics text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ai_training text;

COMMENT ON COLUMN public.products.ai_training IS 'Informações específicas para o chatbot responder sobre este produto (uso, diferenciais, perguntas frequentes, restrições).';
COMMENT ON COLUMN public.chatbot_settings.business_info IS 'Dados da loja (entrega, formas de pagamento, endereço, horários) que a IA pode citar.';
COMMENT ON COLUMN public.chatbot_settings.faq IS 'Perguntas e respostas frequentes da loja.';
COMMENT ON COLUMN public.chatbot_settings.response_examples IS 'Exemplos de respostas modelo (few-shot) para a IA imitar o tom desejado.';
COMMENT ON COLUMN public.chatbot_settings.forbidden_topics IS 'O que a IA NÃO deve responder ou prometer.';
