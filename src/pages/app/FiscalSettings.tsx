import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings, Eye, EyeOff, Copy, Check, Plug, CheckCircle2, XCircle, Headphones, Sparkles, Zap } from 'lucide-react';
import type { Store, NfeioEnvironment } from '@/types/database';

export default function FiscalSettings() {
  const { currentAccount, currentStore, isOwnerOrAdmin, stores } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [apiToken, setApiToken] = useState('');
  const [environment, setEnvironment] = useState<NfeioEnvironment>('homolog');
  const [isActive, setIsActive] = useState(true);
  const [blockSale, setBlockSale] = useState(false);
  const [nfseEnabled, setNfseEnabled] = useState(false);
  const [nfseServiceCode, setNfseServiceCode] = useState('');
  const [nfseCnae, setNfseCnae] = useState('');
  const [nfseAliquota, setNfseAliquota] = useState<string>('0');
  const [nfseDescription, setNfseDescription] = useState('');
  const [nfseIssRetido, setNfseIssRetido] = useState(false);

  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nfeio-webhook`;

  useEffect(() => {
    if (currentStore) {
      setSelectedStoreId(currentStore.id);
    } else if (stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [currentStore, stores]);

  useEffect(() => {
    if (selectedStoreId) loadSettings();
  }, [selectedStoreId]);

  const loadSettings = async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nfeio_settings')
        .select('*')
        .eq('store_id', selectedStoreId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setApiToken(data.api_key);
        setEnvironment(data.environment);
        setIsActive(data.is_active);
        setBlockSale(Boolean((data as any).block_sale_without_fiscal_data));
        setNfseEnabled(Boolean((data as any).nfse_enabled));
        setNfseServiceCode((data as any).nfse_service_code || '');
        setNfseCnae((data as any).nfse_cnae || '');
        setNfseAliquota(String((data as any).nfse_aliquota ?? '0'));
        setNfseDescription((data as any).nfse_item_description || '');
        setNfseIssRetido(Boolean((data as any).nfse_iss_retido));
      } else {
        setSettings(null);
        setApiToken('');
        setEnvironment('homolog');
        setIsActive(true);
        setBlockSale(false);
        setNfseEnabled(false);
        setNfseServiceCode('');
        setNfseCnae('');
        setNfseAliquota('0');
        setNfseDescription('');
        setNfseIssRetido(false);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar configurações', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedStoreId || !apiToken.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha o token da API' });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        api_key: apiToken.trim(),
        environment,
        is_active: isActive,
        block_sale_without_fiscal_data: blockSale,
        nfse_enabled: nfseEnabled,
        nfse_service_code: nfseServiceCode.trim() || null,
        nfse_cnae: nfseCnae.trim() || null,
        nfse_aliquota: Number(nfseAliquota) || 0,
        nfse_item_description: nfseDescription.trim() || null,
        nfse_iss_retido: nfseIssRetido,
      };
      if (settings) {
        const { error } = await supabase
          .from('nfeio_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('nfeio_settings')
          .insert({ store_id: selectedStoreId, webhook_secret: '', ...payload });
        if (error) throw error;
      }

      toast({ title: 'Configurações salvas com sucesso' });
      loadSettings();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedStoreId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione uma loja' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-fiscal-connection', {
        body: { store_id: selectedStoreId },
      });

      if (error) throw error;
      setTestResult(data);

      toast({
        variant: data.success ? 'default' : 'destructive',
        title: data.success ? 'Conexão OK' : 'Falha na conexão',
        description: data.message,
      });
    } catch (error: any) {
      const msg = error.message || 'Erro ao testar conexão';
      setTestResult({ success: false, message: msg });
      toast({ variant: 'destructive', title: 'Erro', description: msg });
    } finally {
      setTesting(false);
    }
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'URL copiada!' });
  };

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const openFiscalSupport = () => {
    const storeName = stores.find((s) => s.id === selectedStoreId)?.name || currentStore?.name || '—';
    const subject = `Ajuda na configuração fiscal — ${storeName}`;
    const content = `Olá, equipe Typos!\n\nPreciso de ajuda para configurar a emissão de notas fiscais (NF-e / NFC-e) para a loja "${storeName}".\n\n📋 Dados da conta:\n• ID da Conta: ${currentAccount?.id || '—'}\n• ID da Loja: ${selectedStoreId || '—'}\n• Nome da Loja: ${storeName}\n• Conta: ${currentAccount?.name || '—'}\n\n✅ Já tenho separado para agilizar:\n• Certificado Digital A1 (.pfx) e senha\n• Token CSC (Código de Segurança do Contribuinte) — para NFC-e/Cupom Fiscal\n• ID do CSC\n• Inscrição Estadual\n• Regime Tributário (Simples Nacional / Lucro Presumido / Real)\n• CNAE principal\n• Série e numeração inicial das notas\n\nPor favor, me orientem sobre o próximo passo para enviar esses dados de forma segura. Aguardo o atendimento!`;

    window.dispatchEvent(
      new CustomEvent('typos:open-support', {
        detail: { subject, content, priority: 'high' },
      })
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações Fiscais</h1>
        <p className="text-muted-foreground">Configure a integração fiscal para emissão de notas</p>
      </div>

      <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-md">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <CardContent className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <Headphones className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">Precisa de ajuda na configuração fiscal?</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Zap className="h-3 w-3" /> Liberação imediata
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A <strong className="text-foreground">equipe Typos!</strong> faz <strong className="text-foreground">todo o processo</strong> de integração fiscal para você.
                Tenha em mãos: <strong className="text-foreground">Certificado Digital A1, Token CSC</strong> (para NFC-e/Cupom Fiscal),
                Inscrição Estadual e Regime Tributário — assim agilizamos sua emissão de notas.
              </p>
            </div>
          </div>
          <Button
            onClick={openFiscalSupport}
            size="lg"
            className="shrink-0 gap-2 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Falar com atendente
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Integração Fiscal
          </CardTitle>
          <CardDescription>
            Configure o token da API para emissão de notas fiscais (NF-e, NFC-e, devoluções)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stores.length > 1 && (
            <div className="space-y-2">
              <Label>Loja</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="api-token">Token da API</Label>
            <div className="relative">
              <Input
                id="api-token"
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Token da API fiscal"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Encontre o token no painel do provedor fiscal → Configurações → API
            </p>
          </div>

          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={environment} onValueChange={(v) => setEnvironment(v as NfeioEnvironment)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="homolog">Homologação (Testes)</SelectItem>
                <SelectItem value="prod">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Integração Ativa</Label>
              <p className="text-sm text-muted-foreground">Habilitar emissão de notas fiscais</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Bloquear venda sem dados fiscais</Label>
                <p className="text-sm text-muted-foreground">
                  Impede finalizar venda no PDV se algum produto estiver sem NCM ou CFOP cadastrado.
                </p>
              </div>
              <Switch checked={blockSale} onCheckedChange={setBlockSale} />
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>NFS-e (Nota Fiscal de Serviço)</Label>
                <p className="text-sm text-muted-foreground">
                  Habilite para emitir NFS-e municipal pela API Focus NFSe.
                </p>
              </div>
              <Switch checked={nfseEnabled} onCheckedChange={setNfseEnabled} />
            </div>

            {nfseEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Código do Serviço (Lista LC 116)</Label>
                  <Input value={nfseServiceCode} onChange={(e) => setNfseServiceCode(e.target.value)} placeholder="ex: 14.01" />
                </div>
                <div className="space-y-2">
                  <Label>CNAE</Label>
                  <Input value={nfseCnae} onChange={(e) => setNfseCnae(e.target.value)} placeholder="ex: 9529102" />
                </div>
                <div className="space-y-2">
                  <Label>Alíquota ISS (%)</Label>
                  <Input type="number" step="0.01" value={nfseAliquota} onChange={(e) => setNfseAliquota(e.target.value)} />
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label>ISS Retido</Label>
                    <p className="text-xs text-muted-foreground">Marque se o ISS é retido pelo tomador.</p>
                  </div>
                  <Switch checked={nfseIssRetido} onCheckedChange={setNfseIssRetido} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Descrição padrão do serviço</Label>
                  <Input value={nfseDescription} onChange={(e) => setNfseDescription(e.target.value)} placeholder="ex: Prestação de serviços de montagem" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Testar Conexão</Label>
                <p className="text-sm text-muted-foreground">
                  Valida o token e verifica se o CNPJ está autorizado no provedor fiscal
                </p>
              </div>
              <Button variant="outline" onClick={handleTestConnection} disabled={testing || !apiToken.trim()}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                Testar
              </Button>
            </div>
            {testResult && (
              <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${testResult.success ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
                {testResult.success ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <Label>URL do Webhook (opcional - configure no provedor fiscal)</Label>
            <div className="mt-2 flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" onClick={copyWebhookUrl}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure esta URL no provedor fiscal para receber atualizações automáticas de status
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
