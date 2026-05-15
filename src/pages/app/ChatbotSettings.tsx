import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Bot, Save, MessageCircle, QrCode, RefreshCw, CheckCircle2, XCircle, Headset, Sparkles, ShieldCheck, GraduationCap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


type ConnectionStatus = 'unknown' | 'connected' | 'disconnected' | 'loading';

const getQrCodeImageSrc = (value?: string | null) => {
  if (!value) return null;

  const normalizedValue = value.trim();
  if (!normalizedValue) return null;

  return normalizedValue.startsWith('data:image')
    ? normalizedValue
    : `data:image/png;base64,${normalizedValue}`;
};

export default function ChatbotSettings() {
  const { currentAccount, currentStore } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasInstance, setHasInstance] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState('');
  const [instanceToken, setInstanceToken] = useState('');
  const [clientToken, setClientToken] = useState('');

  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');

  const [form, setForm] = useState({
    is_active: false,
    greeting_message: 'Olá! 👋 Sou o assistente virtual. Como posso ajudar?',
    ai_instructions: 'Você é um assistente de vendas amigável e informal. Ajude os clientes a encontrar produtos.',
    away_message: 'No momento estamos fora do horário de atendimento. Retornaremos em breve!',
    business_hours_start: '08:00',
    business_hours_end: '18:00',
    tone: 'amigavel_objetivo',
    business_info: '',
    faq: '',
    response_examples: '',
    forbidden_topics: '',
    tracking_message_template: 'Olá {nome_cliente}! 📦 Acompanhe seu pedido #{numero_pedido} em tempo real: {link_rastreio}',
  });

  useEffect(() => {
    if (currentStore) loadSettings();
  }, [currentStore]);

  const loadSettings = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { data } = await supabase
      .from('chatbot_settings')
      .select('*')
      .eq('store_id', currentStore.id)
      .maybeSingle();

    if (data) {
      setSettingsId(data.id);
      const hasInst = !!data.z_api_instance_id && !!data.z_api_instance_token;
      setHasInstance(hasInst);
      setInstanceId(data.z_api_instance_id || '');
      setInstanceToken(data.z_api_instance_token || '');
      setClientToken(data.z_api_client_token || '');
      setForm({
        is_active: data.is_active || false,
        greeting_message: data.greeting_message || '',
        ai_instructions: data.ai_instructions || '',
        away_message: data.away_message || '',
        business_hours_start: data.business_hours_start || '08:00',
        business_hours_end: data.business_hours_end || '18:00',
        tone: (data as any).tone || 'amigavel_objetivo',
        business_info: (data as any).business_info || '',
        faq: (data as any).faq || '',
        response_examples: (data as any).response_examples || '',
        forbidden_topics: (data as any).forbidden_topics || '',
        tracking_message_template: (data as any).tracking_message_template || 'Olá {nome_cliente}! 📦 Acompanhe seu pedido #{numero_pedido} em tempo real: {link_rastreio}',
      });

      if (hasInst) {
        checkConnection(data.z_api_instance_id!, data.z_api_instance_token!, data.z_api_client_token || '');
      }
    } else {
      setHasInstance(false);
      setSettingsId(null);
    }
    setLoading(false);
  };

  const checkConnection = async (instId: string, instToken: string, cliToken: string) => {
    setConnectionStatus('loading');
    try {
      const resp = await fetch(`https://api.z-api.io/instances/${instId}/token/${instToken}/status`, {
        headers: {
          'Client-Token': cliToken,
        },
      });
      if (!resp.ok) {
        setConnectionStatus('disconnected');
        return;
      }
      const data = await resp.json();
      // Z-API returns { connected: true/false } or { error: ... }
      if (data.connected === true) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  const fetchQrCode = async () => {
    if (!instanceId || !instanceToken) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Instância não configurada' });
      return;
    }
    setQrLoading(true);
    setQrCodeBase64(null);
    try {
      const resp = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/qr-code/image`, {
        headers: {
          'Client-Token': clientToken,
        },
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }
      const data = await resp.json();
      const qrCodeSrc = getQrCodeImageSrc(data.value);

      if (qrCodeSrc) {
        setQrCodeBase64(qrCodeSrc);
      } else {
        throw new Error('QR Code não disponível. Verifique se a instância está desconectada.');
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao obter QR Code', description: err.message });
    } finally {
      setQrLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentStore || !currentAccount || !settingsId) return;
    setSaving(true);

    const { error } = await supabase
      .from('chatbot_settings')
      .update({
        ...form,
      })
      .eq('id', settingsId);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } else {
      toast({ title: 'Configurações salvas!' });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!hasInstance) {
    const accountId = currentAccount?.id || '';
    const storeId = currentStore?.id || '';
    const storeName = currentStore?.name || '';
    const accountName = currentAccount?.name || '';

    const openSupportPrefilled = () => {
      const subject = `Configurar instância WhatsApp — ${storeName}`;
      const content =
`Olá, equipe Typos! 👋

Quero ativar o WhatsApp na minha loja. Por favor, validem se meu plano contempla esta funcionalidade e configurem a instância para mim.

📋 Dados para configuração:
• Conta: ${accountName}
• ID da Conta: ${accountId}
• Loja: ${storeName}
• ID da Loja: ${storeId}

Podem chamar um atendente Typos! para me ajudar com a configuração? Obrigado! 🙏`;

      window.dispatchEvent(new CustomEvent('typos:open-support', {
        detail: { subject, content, priority: 'high' },
      }));
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6" /> WhatsApp</h1>
          <p className="text-muted-foreground">Conecte o WhatsApp da sua loja</p>
        </div>

        <Card className="max-w-xl">
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold">A equipe Typos! configura para você</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  A configuração da instância WhatsApp é feita pelo nosso time. Abra um chamado e nós validamos seu plano e ativamos tudo — você não precisa fazer nada técnico.
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">Como funciona</span>
              </div>
              <ul className="space-y-1 pl-5 list-disc text-muted-foreground">
                <li>Validamos se seu plano inclui o módulo WhatsApp</li>
                <li>Se necessário, sugerimos o upgrade adequado</li>
                <li>Configuramos a instância e devolvemos pronta para uso</li>
                <li>Liberação imediata</li>
              </ul>
            </div>

            <Button onClick={openSupportPrefilled} className="w-full gap-2" size="lg">
              <Headset className="h-4 w-4" />
              Falar com a equipe Typos!
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              O chamado já vai pré-preenchido com os IDs da sua conta e loja.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6" /> WhatsApp</h1>
        <p className="text-muted-foreground">Configure o assistente virtual WhatsApp para {currentStore?.name}</p>
      </div>

      {/* Status da conexão */}
      <Card className={`border-l-4 ${connectionStatus === 'connected' ? 'border-l-green-500' : 'border-l-amber-500'}`}>
        <CardContent className="pt-4 pb-4 flex items-center gap-3">
          {connectionStatus === 'loading' ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : connectionStatus === 'connected' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-amber-500" />
          )}
          <div className="flex-1">
            <p className="font-medium text-sm">
              {connectionStatus === 'loading'
                ? 'Verificando conexão...'
                : connectionStatus === 'connected'
                ? 'WhatsApp conectado'
                : 'WhatsApp desconectado'}
            </p>
            <p className="text-xs text-muted-foreground">
              {connectionStatus === 'connected'
                ? 'Sua instância está ativa e pronta para enviar/receber mensagens'
                : connectionStatus === 'loading'
                ? 'Aguarde...'
                : 'Escaneie o QR Code abaixo para conectar seu WhatsApp'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Chatbot ativo</Label>
            <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          </div>
        </CardContent>
      </Card>

      {/* QR Code section - mostrar quando desconectado ou quando o usuário pedir */}
      {connectionStatus !== 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Conectar WhatsApp
            </CardTitle>
            <CardDescription>
              Escaneie o QR Code com o WhatsApp do número da loja para conectar
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qrCodeBase64 ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="p-4 bg-white rounded-xl shadow-sm border">
                  <img
                    src={qrCodeBase64}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Abra o WhatsApp no celular</p>
                  <p className="text-xs text-muted-foreground">
                    Vá em Configurações → Dispositivos conectados → Conectar dispositivo
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchQrCode} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Gerar novo QR Code
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto w-20 h-20 rounded-xl bg-muted flex items-center justify-center">
                  <QrCode className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Clique abaixo para gerar o QR Code de conexão
                </p>
                <Button onClick={fetchQrCode} disabled={qrLoading} className="gap-2">
                  {qrLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4" />
                  )}
                  Gerar QR Code
                </Button>
              </div>
            )}

            {/* Refresh status */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => checkConnection(instanceId, instanceToken, clientToken)}
            >
              <RefreshCw className="h-3 w-3" />
              Verificar conexão
            </Button>
          </CardContent>
        </Card>
      )}




      {/* Base de treinamento da IA */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Base de treinamento da IA
          </CardTitle>
          <CardDescription>
            Quanto mais você ensinar, mais humano e certeiro o atendimento. Cada campo abaixo entra direto no cérebro do chatbot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tom de voz</Label>
              <Select value={form.tone} onValueChange={v => setForm({ ...form, tone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="amigavel_objetivo">Amigável e objetivo (recomendado)</SelectItem>
                  <SelectItem value="formal">Formal e respeitoso</SelectItem>
                  <SelectItem value="descontraido">Descontraído e leve</SelectItem>
                  <SelectItem value="consultivo">Consultivo (faz perguntas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem de boas-vindas</Label>
              <Input value={form.greeting_message} onChange={e => setForm({ ...form, greeting_message: e.target.value })} />
            </div>
          </div>

          <Accordion type="multiple" defaultValue={["business", "instructions"]} className="w-full">
            <AccordionItem value="business">
              <AccordionTrigger className="text-sm">Sobre a loja (entrega, pagamento, endereço)</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={form.business_info}
                  onChange={e => setForm({ ...form, business_info: e.target.value })}
                  rows={6}
                  placeholder={`Exemplo:
- Entregamos em toda a região central, frete grátis acima de R$ 150.
- Aceitamos Pix, cartão e crediário próprio em até 4x.
- Endereço: Rua X, 123 — Centro. Atendimento de seg a sáb, 8h às 18h.
- Retirada na loja em até 30 minutos após o pagamento.`}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="instructions">
              <AccordionTrigger className="text-sm">Instruções gerais para a IA</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={form.ai_instructions}
                  onChange={e => setForm({ ...form, ai_instructions: e.target.value })}
                  rows={4}
                  placeholder={`Exemplo:
- Sempre cumprimente pelo nome quando souber.
- Quando o cliente pedir um produto, ofereça também opções similares.
- Se o cliente perguntar prazo de entrega, peça o CEP antes de responder.
- Encerre oferecendo ajuda com mais alguma coisa.`}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq">
              <AccordionTrigger className="text-sm">Perguntas frequentes (FAQ)</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={form.faq}
                  onChange={e => setForm({ ...form, faq: e.target.value })}
                  rows={6}
                  placeholder={`Exemplo:
P: Vocês fazem entrega no mesmo dia?
R: Sim, para pedidos confirmados até as 14h.

P: Posso trocar o produto?
R: Pode, em até 7 dias com a nota fiscal.

P: Tem desconto no Pix?
R: Sim, 5% de desconto pagando no Pix.`}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="examples">
              <AccordionTrigger className="text-sm">Exemplos de respostas (estilo a imitar)</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={form.response_examples}
                  onChange={e => setForm({ ...form, response_examples: e.target.value })}
                  rows={6}
                  placeholder={`Cliente: "oi vcs tem chocolate?"
Atendente: "Oi! Temos sim 😊 De qual marca você prefere?"

Cliente: "quanto é a entrega pro centro?"
Atendente: "Pro centro o frete sai R$ 8 e chega em até 1h. Quer fechar o pedido?"`}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="forbidden">
              <AccordionTrigger className="text-sm">O que NÃO fazer / NÃO falar</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={form.forbidden_topics}
                  onChange={e => setForm({ ...form, forbidden_topics: e.target.value })}
                  rows={4}
                  placeholder={`Exemplo:
- Nunca prometa prazo de entrega sem confirmar com o lojista.
- Não fale sobre concorrentes.
- Não dê desconto por conta própria — direcione ao vendedor.`}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground">
            💡 <strong>Dica:</strong> Para ensinar a IA sobre um produto específico (uso, diferenciais, perguntas frequentes), edite o produto em <strong>Produtos → Editar → campo "Treinamento IA"</strong>.
          </div>

          <ReindexProductsBox accountId={currentAccount?.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Mensagem de rastreio do pedido (WhatsApp)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Mensagem padrão enviada ao cliente com o link público de rastreio</Label>
          <Textarea
            value={form.tracking_message_template}
            onChange={e => setForm({ ...form, tracking_message_template: e.target.value })}
            rows={3}
            placeholder="Olá {nome_cliente}! Acompanhe seu pedido #{numero_pedido}: {link_rastreio}"
          />
          <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Variáveis disponíveis:</strong></p>
            <p>• <code className="bg-background px-1 rounded">{'{nome_cliente}'}</code> — primeiro nome do cliente</p>
            <p>• <code className="bg-background px-1 rounded">{'{numero_pedido}'}</code> — número do pedido</p>
            <p>• <code className="bg-background px-1 rounded">{'{link_rastreio}'}</code> — link público com timeline do envio</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Atendimento fora do horário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Mensagem fora do horário</Label>
            <Textarea value={form.away_message} onChange={e => setForm({ ...form, away_message: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horário início</Label>
              <Input type="time" value={form.business_hours_start} onChange={e => setForm({ ...form, business_hours_start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Horário fim</Label>
              <Input type="time" value={form.business_hours_end} onChange={e => setForm({ ...form, business_hours_end: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar Configurações
      </Button>
    </div>
  );
}

function ReindexProductsBox({ accountId }: { accountId?: string }) {
  const { toast } = useToast();
  const [missing, setMissing] = useState<number | null>(null);
  const [indexed, setIndexed] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [lastProcessed, setLastProcessed] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const [missingRes, indexedRes, totalRes] = await Promise.all([
      supabase.rpc('products_missing_embedding_count', { _account_id: accountId }),
      supabase.rpc('products_indexed_count' as any, { _account_id: accountId } as any),
      supabase.rpc('products_total_active_count' as any, { _account_id: accountId } as any),
    ]);
    setMissing((missingRes.data as any) ?? 0);
    setIndexed(Number((indexedRes.data as any) ?? 0));
    setTotal(Number((totalRes.data as any) ?? 0));
    setLoading(false);
  }, [accountId]);

  useEffect(() => { refresh(); }, [refresh]);

  const progressValue = total > 0 ? Math.min(100, Math.round((indexed / total) * 100)) : 0;

  const run = async (force: boolean) => {
    if (!accountId) return;
    setRunning(true);
    setLastProcessed(0);
    try {
      let totalProcessed = 0;
      let remaining = Infinity;
      let currentIndexed = force ? 0 : indexed;
      let currentTotal = total;
      let firstRun = true;
      let safety = 200;
      while (remaining > 0 && safety-- > 0) {
        const { data, error } = await supabase.functions.invoke('embed-products', {
          body: { accountId, force, resetIndex: force && firstRun },
        });
        if (error) throw error;
        const r = data as any;
        const processedNow = Number(r?.processed || 0);
        totalProcessed += processedNow;
        remaining = Number(r?.remaining ?? 0);
        currentIndexed = Number(r?.indexed ?? currentIndexed);
        currentTotal = Number(r?.total ?? currentTotal);
        setLastProcessed(totalProcessed);
        setMissing(remaining);
        setIndexed(currentIndexed);
        setTotal(currentTotal);
        firstRun = false;
        if (processedNow === 0) break;
      }
      const successTitle = remaining === 0 ? 'Reindexação concluída' : 'Reindexação pausada';
      const successDescription = remaining === 0
        ? `${totalProcessed} produto(s) processados. ${currentIndexed}/${currentTotal} indexados.`
        : `${totalProcessed} produto(s) processados. Clique novamente para continuar os ${remaining} restantes.`;
      toast({ title: successTitle, description: successDescription });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erro ao indexar', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">Busca semântica de produtos (IA)</p>
          <p className="text-xs text-muted-foreground mt-1">
            O chatbot usa IA para entender o que o cliente quer mesmo com erros de digitação, sinônimos ou palavras fora de ordem.
            Reindexe sempre que cadastrar muitos produtos novos ou editar nomes/treinamentos.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs">
          {loading ? 'Verificando…' : (
            <><strong>{indexed}</strong> de <strong>{total}</strong> produtos indexados • Restantes: <strong>{missing ?? 0}</strong></>
          )}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => run(false)} disabled={running || !accountId}>
            {running ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-2" />}
            Indexar pendentes
          </Button>
          <Button size="sm" variant="ghost" onClick={() => run(true)} disabled={running || !accountId}>
            Reindexar tudo
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Progress value={progressValue} className="h-2" />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{progressValue}% concluído</span>
          <span>{running ? `${lastProcessed} processado(s) nesta execução` : 'Pronto para indexar'}</span>
        </div>
      </div>
    </div>
  );
}
