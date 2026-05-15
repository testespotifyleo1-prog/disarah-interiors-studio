import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ShieldCheck, ExternalLink, Copy, Check, Eye, EyeOff, KeyRound, Truck } from 'lucide-react';

const REDIRECT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/melhor-envio-connect`;

export function MelhorEnvioCredentials() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isSandbox, setIsSandbox] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('melhor_envio_global_credentials').select('*').limit(1).maybeSingle();
    if (data) {
      setId(data.id);
      setClientId(data.client_id || '');
      setClientSecret(data.client_secret || '');
      setIsSandbox(!!data.is_sandbox);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({ variant: 'destructive', title: 'Preencha Client ID e Secret' });
      return;
    }
    setSaving(true);
    try {
      const payload = { client_id: clientId.trim(), client_secret: clientSecret.trim(), is_sandbox: isSandbox, is_active: true };
      const { error } = id
        ? await (supabase as any).from('melhor_envio_global_credentials').update(payload).eq('id', id)
        : await (supabase as any).from('melhor_envio_global_credentials').insert(payload);
      if (error) throw error;
      toast({ title: 'Credenciais Melhor Envio salvas!', description: 'Lojistas podem agora conectar Correios, Jadlog, Loggi, etc.' });
      void load();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message });
    } finally { setSaving(false); }
  };

  const copyRedirect = async () => {
    await navigator.clipboard.writeText(REDIRECT_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const hasSaved = !!id;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-[#0D6EFD] flex items-center justify-center text-white shrink-0">
          <Truck className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">Credenciais Melhor Envio</h2>
            {hasSaved ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
                <ShieldCheck className="h-3 w-3" /> OAuth Real Ativo
              </Badge>
            ) : <Badge variant="secondary">Não configurado</Badge>}
            {isSandbox && <Badge variant="outline" className="text-amber-700 border-amber-300">Sandbox</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Uma única integração libera Correios (PAC/SEDEX), Jadlog, Loggi, Azul Cargo, J&T e mais. Lojistas escolhem quais transportadoras usar.
          </p>
        </div>
      </div>

      <Card className="border-l-4 border-l-[#0D6EFD]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1️⃣ Redirect URI</CardTitle>
          <CardDescription className="text-xs">
            No painel Melhor Envio, em <strong>Configurações → Tokens → Suas aplicações → Redirect URI</strong>:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={REDIRECT_URL} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyRedirect}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> 2️⃣ Credenciais OAuth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-xs">Modo Sandbox</Label>
              <p className="text-[11px] text-muted-foreground">Usa <code>sandbox.melhorenvio.com.br</code>. Desligue em produção.</p>
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
          <CardTitle className="text-sm">3️⃣ Como obter as credenciais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
            <li>
              Crie uma conta em{' '}
              <a href="https://melhorenvio.com.br/cadastro" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                melhorenvio.com.br/cadastro <ExternalLink className="h-3 w-3" />
              </a>
              {' '}(grátis, sem mensalidade).
            </li>
            <li>Logado, acesse{' '}
              <a href="https://melhorenvio.com.br/painel/gerenciar/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                Painel → Configurações → Tokens <ExternalLink className="h-3 w-3" />
              </a>.
            </li>
            <li>Aba <strong>"Suas aplicações"</strong> → <strong>Criar nova aplicação</strong>:
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                <li><strong>Nome</strong>: Typos ERP</li>
                <li><strong>E-mail</strong>: seu e-mail técnico</li>
                <li><strong>Redirect URI</strong>: cole a URL do passo 1️⃣</li>
                <li><strong>Escopos</strong>: marque <code>shipping-calculate</code>, <code>shipping-cancel</code>, <code>shipping-checkout</code>, <code>shipping-companies</code>, <code>shipping-coupons</code>, <code>shipping-notifications</code>, <code>shipping-services</code>, <code>shipping-tracking</code>, <code>cart-read</code>, <code>cart-write</code>, <code>orders-read</code>, <code>users-read</code>, <code>transactions-read</code></li>
              </ul>
            </li>
            <li>Após criar, copie o <strong>Client ID</strong> e clique em <strong>"Gerar segredo"</strong> para obter o <strong>Client Secret</strong>.</li>
            <li>Cole acima e salve. Pronto.</li>
          </ol>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900">
            <strong>⚡ Aprovação imediata:</strong> Diferente de Amazon/Magalu, Melhor Envio aprova a aplicação na hora — funciona em produção em segundos.
          </div>
          <a href="https://docs.melhorenvio.com.br/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
            Documentação oficial Melhor Envio <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
