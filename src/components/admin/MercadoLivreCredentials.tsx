import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ShieldCheck, ExternalLink, Copy, Check, Eye, EyeOff, KeyRound } from 'lucide-react';
import { MercadoLivreLogo } from '@/components/brand/BrandLogos';

const PROVIDER = 'mercadolivre';
const REDIRECT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meli-connect`;

export function MercadoLivreCredentials() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appId, setAppId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('integration_credentials')
      .select('key_name, key_value')
      .eq('provider', PROVIDER);

    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r: any) => { map[r.key_name] = r.key_value; });
      setAppId(map.app_id || '');
      setClientSecret(map.client_secret || '');
      setHasSaved(!!(map.app_id && map.client_secret));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!appId.trim() || !clientSecret.trim()) {
      toast({ variant: 'destructive', title: 'Preencha os dois campos' });
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const rows = [
        { provider: PROVIDER, key_name: 'app_id', key_value: appId.trim(), updated_by: userId },
        { provider: PROVIDER, key_name: 'client_secret', key_value: clientSecret.trim(), updated_by: userId },
      ];

      const { error } = await supabase
        .from('integration_credentials')
        .upsert(rows, { onConflict: 'provider,key_name' });

      if (error) throw error;
      toast({ title: 'Credenciais Mercado Livre salvas!', description: 'OAuth real ativado para todas as lojas.' });
      setHasSaved(true);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const copyRedirect = async () => {
    await navigator.clipboard.writeText(REDIRECT_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-[#FFE600] flex items-center justify-center">
          <MercadoLivreLogo className="h-9 w-9" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">Credenciais Mercado Livre Developers</h2>
            {hasSaved ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
                <ShieldCheck className="h-3 w-3" /> OAuth Real Ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">Modo Demonstração</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre uma única vez o App ID e o Client Secret. Todas as lojas do sistema passam a usar OAuth real do Mercado Livre automaticamente.
          </p>
        </div>
      </div>

      {/* Redirect URL — cole no ML Developers */}
      <Card className="border-l-4 border-l-[#FFE600]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1️⃣ Redirect URI</CardTitle>
          <CardDescription className="text-xs">
            No painel Mercado Livre Developers, em <strong>Sua aplicação → Configuração → URI de redirecionamento</strong>, cole exatamente esta URL:
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

      {/* Credenciais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> 2️⃣ Suas credenciais Mercado Livre</CardTitle>
          <CardDescription className="text-xs">
            Disponíveis em <strong>developers.mercadolivre.com.br → Suas aplicações → seu app → Credenciais</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">App ID (Client ID)</Label>
            <Input
              placeholder="Ex.: 1234567890123456"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Número longo gerado pelo ML ao criar sua aplicação.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client Secret (Secret Key)</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                placeholder="Cole o Client Secret aqui"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">String secreta. No painel ML, clique em <em>"Mostrar"</em> para revelar antes de copiar.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar credenciais
          </Button>
        </CardContent>
      </Card>

      {/* Passo a passo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">3️⃣ Como obter App ID e Client Secret</CardTitle>
          <CardDescription className="text-xs">Passo a passo no painel Mercado Livre Developers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
            <li>
              Acesse{' '}
              <a
                href="https://developers.mercadolivre.com.br/devcenter"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                developers.mercadolivre.com.br <ExternalLink className="h-3 w-3" />
              </a>{' '}
              e faça login com sua conta de vendedor.
            </li>
            <li>Clique em <strong>Suas aplicações → Criar aplicação</strong>.</li>
            <li>
              Preencha o formulário:
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                <li><strong>Nome curto da aplicação</strong>: Typos ERP</li>
                <li><strong>Nome longo / Descrição</strong>: Integração ERP para sincronização de produtos, estoque e pedidos</li>
                <li><strong>URL do site</strong>: https://typoserp.com.br</li>
                <li><strong>URI de redirecionamento</strong>: cole a URL do passo 1️⃣ acima</li>
              </ul>
            </li>
            <li>
              Em <strong>Tópicos de notificação</strong> (opcional, pode marcar depois):
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                <li><strong>orders_v2</strong> — pedidos novos e atualizações</li>
                <li><strong>items</strong> — alterações em anúncios</li>
                <li><strong>questions</strong> — perguntas dos compradores</li>
              </ul>
            </li>
            <li>
              Em <strong>Escopos</strong>, marque:
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                <li><strong>read</strong> — leitura de catálogo, pedidos e usuário</li>
                <li><strong>write</strong> — criação/atualização de anúncios</li>
                <li><strong>offline_access</strong> — refresh tokens (essencial)</li>
              </ul>
            </li>
            <li>Salve a aplicação. Você será direcionado para a tela com <strong>App ID</strong> e <strong>Client Secret</strong>.</li>
            <li>Copie ambos e cole no formulário acima ☝️ e clique em <strong>Salvar credenciais</strong>.</li>
          </ol>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground border border-border/60 mt-4">
            <strong className="text-foreground">⚡ Ativação imediata:</strong> Assim que você salvar, o botão "Conectar conta vendedor Mercado Livre" em{' '}
            <code className="font-mono bg-background px-1 py-0.5 rounded">/app/integrations/mercado-livre</code> passa automaticamente do modo demonstração para OAuth real — sem precisar redeploy.
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900 mt-2">
            <strong>⚠️ Importante:</strong> O Mercado Livre exige HTTPS na URI de redirecionamento (já garantido pelo Lovable Cloud). Para liberar limites de produção, você pode precisar enviar a app para revisão no próprio painel ML.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
