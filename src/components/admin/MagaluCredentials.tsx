import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ShieldCheck, ExternalLink, Copy, Check, Eye, EyeOff, KeyRound } from 'lucide-react';

const REDIRECT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/magalu-connect`;

export function MagaluCredentials() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.magalu.com');
  const [scope, setScope] = useState('openid offline_access marketplace');
  const [isSandbox, setIsSandbox] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('magalu_global_credentials').select('*').limit(1).maybeSingle();
    if (data) {
      setId(data.id);
      setClientId(data.client_id || '');
      setClientSecret(data.client_secret || '');
      setApiBaseUrl(data.api_base_url || 'https://api.magalu.com');
      setScope(data.scope || 'openid offline_access marketplace');
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
      const payload = {
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        api_base_url: apiBaseUrl.trim() || 'https://api.magalu.com',
        scope: scope.trim() || 'openid offline_access marketplace',
        is_sandbox: isSandbox,
        is_active: true,
      };
      const { error } = id
        ? await (supabase as any).from('magalu_global_credentials').update(payload).eq('id', id)
        : await (supabase as any).from('magalu_global_credentials').insert(payload);
      if (error) throw error;
      toast({ title: 'Credenciais Magalu salvas!' });
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
        <div className="h-12 w-12 rounded-lg bg-[#0086FF] flex items-center justify-center text-white font-bold text-xl shrink-0">M</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">Credenciais Magazine Luiza Marketplace</h2>
            {hasSaved ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
                <ShieldCheck className="h-3 w-3" /> OAuth Real Ativo
              </Badge>
            ) : <Badge variant="secondary">Não configurado</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Configure uma vez. Lojistas conectam suas contas de seller no Magalu Marketplace via OAuth.
          </p>
        </div>
      </div>

      <Card className="border-l-4 border-l-[#0086FF]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1️⃣ OAuth Callback URL</CardTitle>
          <CardDescription className="text-xs">
            Cole esta URL no painel de desenvolvedor Magalu, em <strong>Callback URLs</strong>:
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
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> 2️⃣ Credenciais OAuth2</CardTitle>
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
          <div className="space-y-1.5">
            <Label className="text-xs">API Base URL</Label>
            <Input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} className="font-mono" />
            <p className="text-[10px] text-muted-foreground">Padrão: https://api.magalu.com</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">OAuth Scope</Label>
            <Input value={scope} onChange={(e) => setScope(e.target.value)} className="font-mono" />
            <p className="text-[10px] text-muted-foreground">Escopo aprovado no Magalu Developer Portal. Padrão: <code>openid offline_access marketplace</code></p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-xs">Modo Sandbox</Label>
              <p className="text-[11px] text-muted-foreground">Use ambiente de testes Magalu durante desenvolvimento.</p>
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
              Acesse{' '}
              <a href="https://developer.magalu.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                developer.magalu.com <ExternalLink className="h-3 w-3" />
              </a>
              {' '}e faça login (ou crie conta de parceiro Magalu).
            </li>
            <li>Acesse <strong>Marketplace API → Solicitar acesso</strong> (necessário ter contrato de seller ativo no Magalu Marketplace).</li>
            <li>Após aprovação (1-2 semanas), entre em <strong>Minhas Aplicações → Nova Aplicação</strong>:
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                <li><strong>Nome</strong>: Typos ERP</li>
                <li><strong>Tipo</strong>: Web Application</li>
                <li><strong>Callback URL</strong>: cole a URL do passo 1️⃣</li>
                <li><strong>Scopes</strong>: orders.read, orders.write, products.read, products.write, inventory.write, prices.write</li>
              </ul>
            </li>
            <li>Copie o <strong>Client ID</strong> e <strong>Client Secret</strong> exibidos.</li>
            <li>Cole acima e salve.</li>
          </ol>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-900">
            <strong>📋 Pré-requisito:</strong> Cada lojista que for conectar precisa ter contrato de Seller ativo no Magalu Marketplace (não é só cadastro).
          </div>
          <a href="https://developer.magalu.com/api-portal/marketplace" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
            Documentação oficial Magalu Marketplace <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
