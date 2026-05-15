import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ShieldCheck, ExternalLink, Eye, EyeOff, KeyRound, Zap } from 'lucide-react';

export function UberDirectCredentials() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isSandbox, setIsSandbox] = useState(true);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('uber_direct_global_credentials').select('*').limit(1).maybeSingle();
    if (data) {
      setId(data.id);
      setCustomerId(data.customer_id || '');
      setClientId(data.client_id || '');
      setClientSecret(data.client_secret || '');
      setIsSandbox(!!data.is_sandbox);
      setWebhookSecret(data.webhook_signing_secret || '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!customerId.trim() || !clientId.trim() || !clientSecret.trim()) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId.trim(),
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        webhook_signing_secret: webhookSecret.trim() || null,
        is_sandbox: isSandbox,
        is_active: true,
      };
      const { error } = id
        ? await (supabase as any).from('uber_direct_global_credentials').update(payload).eq('id', id)
        : await (supabase as any).from('uber_direct_global_credentials').insert(payload);
      if (error) throw error;
      toast({ title: 'Credenciais Uber Direct salvas!' });
      void load();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const hasSaved = !!id;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-black flex items-center justify-center text-white shrink-0">
          <Zap className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">Credenciais Uber Direct</h2>
            {hasSaved ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
                <ShieldCheck className="h-3 w-3" /> Configurado
              </Badge>
            ) : <Badge variant="secondary">Não configurado</Badge>}
            {isSandbox && <Badge variant="outline" className="text-amber-700 border-amber-300">Sandbox</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Entrega on-demand local (motoboy/carro Uber). Lojistas cadastram dados da empresa no painel deles — sem OAuth.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> Credenciais OAuth Server-to-Server</CardTitle>
          <CardDescription className="text-xs">
            Disponíveis em <strong>developer.uber.com → Apps → seu App → Auth</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Customer ID</Label>
            <Input placeholder="UUID do customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="font-mono" />
            <p className="text-[10px] text-muted-foreground">Identificador da conta Uber Direct master. Geralmente um UUID.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client ID</Label>
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client Secret</Label>
            <div className="relative">
              <Input type={showSecret ? 'text' : 'password'} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="font-mono pr-10" />
              <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Webhook Signing Secret <span className="text-muted-foreground font-normal">(opcional, recomendado)</span></Label>
            <Input
              type={showSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              className="font-mono"
              placeholder="Cole aqui o secret do webhook configurado no Uber"
            />
            <p className="text-[10px] text-muted-foreground">Valida HMAC-SHA256 no header <code>x-postmates-signature</code> ou <code>x-uber-signature</code> de cada webhook recebido. Sem isso, qualquer requisição é aceita.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-xs">Modo Sandbox</Label>
              <p className="text-[11px] text-muted-foreground">Usa <code>sandbox-api.uber.com</code>. Desligue em produção.</p>
            </div>
            <Switch checked={isSandbox} onCheckedChange={setIsSandbox} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar credenciais
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Como obter as credenciais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
            <li>
              Solicite acesso comercial em{' '}
              <a href="https://merchants.ubereats.com/br/pt-br/delivery/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                merchants.ubereats.com/br/delivery <ExternalLink className="h-3 w-3" />
              </a>{' '}— preencha o formulário "Uber Direct".
            </li>
            <li>Após contato comercial e aprovação (1-3 semanas), você receberá um <strong>Customer ID</strong>.</li>
            <li>Acesse{' '}
              <a href="https://developer.uber.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                developer.uber.com <ExternalLink className="h-3 w-3" />
              </a>{' '}e crie um App em <strong>Dashboard → Apps → New App</strong>.
            </li>
            <li>Em <strong>Auth → Server-to-Server</strong>, ative <code>direct.organizations</code> e <code>eats.deliveries</code>.</li>
            <li>Copie <strong>Client ID</strong> e <strong>Client Secret</strong>.</li>
            <li>Cole acima junto com o Customer ID e salve.</li>
          </ol>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
            <strong>💳 Modelo de cobrança:</strong> Uber Direct cobra você (master account) por entrega. Você repassa para o lojista via cobrança no ERP ou via cartão corporativo cadastrado por ele no painel.
          </div>
          <a href="https://developer.uber.com/docs/deliveries/introduction" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
            Documentação Uber Direct API <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
