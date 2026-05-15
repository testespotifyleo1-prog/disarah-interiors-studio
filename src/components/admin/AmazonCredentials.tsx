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

const REDIRECT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/amazon-connect`;

export function AmazonCredentials() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [lwaClientId, setLwaClientId] = useState('');
  const [lwaClientSecret, setLwaClientSecret] = useState('');
  const [appId, setAppId] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [marketplaceId, setMarketplaceId] = useState('A2Q3Y263D00KWC');
  const [isSandbox, setIsSandbox] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('amazon_global_credentials').select('*').limit(1).maybeSingle();
    if (data) {
      setId(data.id);
      setLwaClientId(data.lwa_client_id || '');
      setLwaClientSecret(data.lwa_client_secret || '');
      setAppId(data.app_id || '');
      setAwsRegion(data.aws_region || 'us-east-1');
      setMarketplaceId(data.marketplace_id || 'A2Q3Y263D00KWC');
      setIsSandbox(!!data.is_sandbox);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!lwaClientId.trim() || !lwaClientSecret.trim()) {
      toast({ variant: 'destructive', title: 'Preencha LWA Client ID e Secret' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        lwa_client_id: lwaClientId.trim(),
        lwa_client_secret: lwaClientSecret.trim(),
        app_id: appId.trim() || null,
        aws_region: awsRegion,
        marketplace_id: marketplaceId,
        is_sandbox: isSandbox,
        is_active: true,
      };
      const { error } = id
        ? await (supabase as any).from('amazon_global_credentials').update(payload).eq('id', id)
        : await (supabase as any).from('amazon_global_credentials').insert(payload);
      if (error) throw error;
      toast({ title: 'Credenciais Amazon salvas!', description: 'OAuth SP-API ativo para todas as lojas.' });
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
        <div className="h-12 w-12 rounded-lg bg-[#FF9900] flex items-center justify-center text-white font-bold text-xl shrink-0">a.</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">Credenciais Amazon SP-API</h2>
            {hasSaved ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
                <ShieldCheck className="h-3 w-3" /> OAuth Real Ativo
              </Badge>
            ) : <Badge variant="secondary">Não configurado</Badge>}
            {isSandbox && <Badge variant="outline" className="text-amber-700 border-amber-300">Sandbox</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Configure uma vez. Todos os lojistas conectam a própria conta Seller Central via OAuth SP-API.
          </p>
        </div>
      </div>

      <Card className="border-l-4 border-l-[#FF9900]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1️⃣ OAuth Redirect URI</CardTitle>
          <CardDescription className="text-xs">
            Cole esta URL em <strong>Seller Central → Apps & Services → Develop Apps → Edit App → OAuth Redirect URI</strong>:
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
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> 2️⃣ Credenciais LWA (Login with Amazon)</CardTitle>
          <CardDescription className="text-xs">
            Em <strong>Seller Central → Develop Apps → seu App → View → LWA credentials</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">App ID (opcional)</Label>
            <Input placeholder="amzn1.sp.solution.xxxxxxxx" value={appId} onChange={(e) => setAppId(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">LWA Client ID</Label>
            <Input placeholder="amzn1.application-oa2-client.xxxxxxxx" value={lwaClientId} onChange={(e) => setLwaClientId(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">LWA Client Secret</Label>
            <div className="relative">
              <Input type={showSecret ? 'text' : 'password'} value={lwaClientSecret} onChange={(e) => setLwaClientSecret(e.target.value)} className="font-mono pr-10" />
              <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">AWS Region</Label>
              <select value={awsRegion} onChange={(e) => setAwsRegion(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="us-east-1">us-east-1 (Brasil/EUA)</option>
                <option value="eu-west-1">eu-west-1 (Europa)</option>
                <option value="us-west-2">us-west-2 (Ásia/Pacífico)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Marketplace ID</Label>
              <Input value={marketplaceId} onChange={(e) => setMarketplaceId(e.target.value)} className="font-mono" />
              <p className="text-[10px] text-muted-foreground">Brasil: A2Q3Y263D00KWC</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-xs">Modo Sandbox</Label>
              <p className="text-[11px] text-muted-foreground">Use durante desenvolvimento. Desligue em produção.</p>
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
              <a href="https://sellercentral.amazon.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                sellercentral.amazon.com.br <ExternalLink className="h-3 w-3" />
              </a>
              {' '}e faça login com a conta master.
            </li>
            <li>Menu superior: <strong>Apps & Services → Develop Apps</strong>.</li>
            <li>Clique em <strong>Add new app client</strong>:
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                <li><strong>App name</strong>: Typos ERP</li>
                <li><strong>API Type</strong>: SP-API</li>
                <li><strong>OAuth Login URI</strong>: deixe em branco</li>
                <li><strong>OAuth Redirect URI</strong>: cole a URL do passo 1️⃣ acima</li>
              </ul>
            </li>
            <li>Em <strong>Roles</strong> selecione: Product Listing, Inventory, Orders, Reports, Pricing.</li>
            <li>Salve. A Amazon vai pedir <strong>aprovação manual</strong> (geralmente 1-3 semanas).</li>
            <li>Após aprovação, em <strong>View → LWA credentials</strong>, copie:
              <ul className="ml-6 mt-1 list-disc">
                <li>App ID (começa com <code>amzn1.sp.solution</code>)</li>
                <li>LWA Client ID (começa com <code>amzn1.application-oa2-client</code>)</li>
                <li>LWA Client Secret</li>
              </ul>
            </li>
            <li>Cole acima e salve. Pronto — lojistas podem conectar.</li>
          </ol>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
            <strong>⏳ Aprovação demorada:</strong> A Amazon valida apps SP-API manualmente. Use modo Sandbox para testes enquanto aguarda.
          </div>
          <a href="https://developer-docs.amazon.com/sp-api/docs/registering-your-application" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
            Documentação oficial SP-API <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
