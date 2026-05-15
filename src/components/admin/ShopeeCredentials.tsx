import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ShieldCheck, ExternalLink, Copy, Check, Eye, EyeOff, KeyRound } from 'lucide-react';
import { ShopeeLogo } from '@/components/brand/BrandLogos';

const PROVIDER = 'shopee';
const REDIRECT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopee-connect`;

export function ShopeeCredentials() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [partnerKey, setPartnerKey] = useState('');
  const [showKey, setShowKey] = useState(false);
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
      setPartnerId(map.partner_id || '');
      setPartnerKey(map.partner_key || '');
      setHasSaved(!!(map.partner_id && map.partner_key));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!partnerId.trim() || !partnerKey.trim()) {
      toast({ variant: 'destructive', title: 'Preencha os dois campos' });
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const rows = [
        { provider: PROVIDER, key_name: 'partner_id', key_value: partnerId.trim(), updated_by: userId },
        { provider: PROVIDER, key_name: 'partner_key', key_value: partnerKey.trim(), updated_by: userId },
      ];

      const { error } = await supabase
        .from('integration_credentials')
        .upsert(rows, { onConflict: 'provider,key_name' });

      if (error) throw error;
      toast({ title: 'Credenciais Shopee salvas!', description: 'OAuth real ativado para todas as lojas.' });
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
        <ShopeeLogo className="h-12 w-12 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">Credenciais Shopee Open Platform</h2>
            {hasSaved ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
                <ShieldCheck className="h-3 w-3" /> OAuth Real Ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">Modo Demonstração</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre uma única vez o Partner ID e Partner Key. Todas as lojas do sistema passam a usar OAuth real automaticamente.
          </p>
        </div>
      </div>

      {/* Redirect URL — cole na Shopee */}
      <Card className="border-l-4 border-l-[#EE4D2D]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1️⃣ Authorization Callback URL</CardTitle>
          <CardDescription className="text-xs">
            No painel Shopee Open Platform, em <strong>App Information → Authorization Callback URL</strong>, cole exatamente esta URL:
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
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> 2️⃣ Suas credenciais Shopee</CardTitle>
          <CardDescription className="text-xs">
            Disponíveis no painel Shopee Open Platform em <strong>Console → App List → seu App → App Information</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Partner ID</Label>
            <Input
              placeholder="Ex.: 2001234"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Número fornecido pela Shopee ao criar o App.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Partner Key (segredo)</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="Cole o Partner Key aqui"
                value={partnerKey}
                onChange={(e) => setPartnerKey(e.target.value)}
                className="font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">String longa secreta. No painel Shopee, clique em <em>"View"</em> para revelar antes de copiar.</p>
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
          <CardTitle className="text-sm">3️⃣ Como obter Partner ID e Partner Key</CardTitle>
          <CardDescription className="text-xs">Passo a passo no painel Shopee Open Platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
            <li>
              Acesse{' '}
              <a
                href="https://open.shopee.com.br/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                open.shopee.com.br <ExternalLink className="h-3 w-3" />
              </a>{' '}
              e crie sua conta de parceiro (use o e-mail corporativo).
            </li>
            <li>No painel: <strong>Console → App List → Add New App</strong>.</li>
            <li>
              Tipo de App: <strong>In-region App – Brazil</strong>. Preencha:
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                <li><strong>App Name</strong>: Typos ERP</li>
                <li><strong>Description</strong>: Integração ERP para sincronização de produtos, estoque e pedidos</li>
                <li><strong>Region</strong>: Brazil (BR)</li>
              </ul>
            </li>
            <li>
              Em <strong>Permissions / Modules</strong>, marque:
              <ul className="ml-6 mt-1 list-disc space-y-0.5">
                <li>Shop Management (auth_partner / token)</li>
                <li>Product Management (item.add / item.update / item.get_item_list)</li>
                <li>Order Management (order.get_order_list / order.get_order_detail)</li>
                <li>Logistics (logistics.get_shipping_parameter)</li>
              </ul>
            </li>
            <li>Em <strong>App Information → Authorization Callback URL</strong>, cole a URL do passo 1️⃣ acima.</li>
            <li>Volte em <strong>App Information</strong> e copie o <strong>Partner ID</strong> e o <strong>Partner Key</strong> (clique em <em>View</em> para revelar).</li>
            <li>Cole no formulário acima ☝️ e clique em <strong>Salvar credenciais</strong>.</li>
          </ol>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground border border-border/60 mt-4">
            <strong className="text-foreground">⚡ Ativação imediata:</strong> Assim que você salvar, o botão "Conectar conta vendedor Shopee" em{' '}
            <code className="font-mono bg-background px-1 py-0.5 rounded">/app/integrations/shopee</code> passa automaticamente do modo demonstração para OAuth real — sem precisar redeploy.
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900 mt-2">
            <strong>⚠️ Aprovação Shopee:</strong> Apps em produção podem exigir aprovação manual da Shopee (2–5 dias úteis). Apps em modo Sandbox/Test funcionam imediatamente.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
