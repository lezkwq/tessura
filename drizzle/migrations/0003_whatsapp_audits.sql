CREATE TABLE public.message_rules (
  user_id uuid PRIMARY KEY,
  instructions text NOT NULL DEFAULT 'Escreva uma mensagem inicial de WhatsApp em português do Brasil, de Leandro para uma empresa. Comece com ''Olá''. Se o nome da pessoa não estiver confirmado, use ''pessoal da [Empresa]''. Apresente-se como Leandro no começo. Ordem: um detalhe concreto e comprovável com a fonte (por exemplo ''Vi no Google que…''), depois o benefício de um site para aquele detalhe em uma frase, que pode falar em ajudar a atrair mais clientes, depois curiosidade honesta sem revelar a solução inteira, e por fim a pergunta: posso explicar a ideia em 2 minutos? Entre 35 e 60 palavras. Sem emoji, sem link, sem preço, sem prazo. Evite: promoção, desconto, oferta, grátis, PIX, boleto, garanta, imperdível, urgente, ''vocês estão perdendo clientes''. Use somente fatos das observações marcadas e dos dados fornecidos. Nunca invente número, serviço, cliente ou site. Se um fato não está nos dados, não o cite. Se nada marcado servir, responda que precisa de mais observações. Não pareça agência: nada de ''valorizar'', ''fortalecer'', ''potencializar'', ''soluções''.',
  min_words integer NOT NULL DEFAULT 35,
  max_words integer NOT NULL DEFAULT 60,
  opening text NOT NULL DEFAULT 'Olá',
  signer text NOT NULL DEFAULT 'Leandro',
  banned_words text[] NOT NULL DEFAULT ARRAY['promoção','desconto','oferta','grátis','PIX','boleto','garanta','imperdível','urgente','vocês estão perdendo clientes','valorizar','fortalecer','potencializar','soluções'],
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_rules TO authenticated;
GRANT ALL ON public.message_rules TO service_role;
ALTER TABLE public.message_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_rules ON public.message_rules TO authenticated USING (user_id = auth.uid() AND public.is_owner()) WITH CHECK (user_id = auth.uid() AND public.is_owner());

CREATE TABLE public.audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  observations text[] NOT NULL DEFAULT '{}',
  message text NOT NULL,
  word_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'não enviada',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_audits ON public.audits TO authenticated USING (user_id = auth.uid() AND public.is_owner()) WITH CHECK (user_id = auth.uid() AND public.is_owner());
CREATE INDEX audits_business_idx ON public.audits(business_id);