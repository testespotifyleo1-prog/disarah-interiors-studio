import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle2, Loader2, Power, Save, Smartphone, TestTube2 } from 'lucide-react';
import { MercadoPagoLogo } from '@/components/brand/BrandLogos';

interface MpConn {
  id?: string;
  store_id?: string;
  access_token?: string;
  public_key?: string;
  environment?: 'production' | 'sandbox';
  status?: 'connected' | 'disconnected' | 'error';
  nickname?: string;
  enabled_methods?: string[];
  point_device_id?: string;
  point_device_name?: string;
  credit_fee_percent?: number;
  debit_fee_percent?: number;
}

export default function MercadoPagoIntegration() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentAccount, currentStore } = useAuth();


  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [conn, setConn] = useState<MpConn>({
    environment: 'production',
    status: 'disconnected',
    enabled_methods: ['pix', 'credit_card', 'debit_card'],
    credit_fee_percent: 0,
    debit_fee_percent: 0,
  });
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    if (!currentStore?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('mp_connections')
        .select('*')
        .eq('store_id', currentStore.id)
        .maybeSingle();
      if (data) setConn(data);
      setLoading(false);
    })();
  }, [currentStore?.id]);

  const toggleMethod = (m: string) => {
    const cur = conn.enabled_methods || [];
    setConn({ ...conn, enabled_methods: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] });
  };

  const handleTest = async () => {
    if (!conn.access_token) {
      toast({ variant: 'destructive', title: 'Informe o Access Token' });
      return;
    }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('mp-connection', {
      body: { action: 'test', access_token: conn.access_token },
    });
    setTesting(false);
    if (error || (data as any)?.error) {
      toast({ variant: 'destructive', title: 'Token inválido', description: (data as any)?.error || error?.message });
    } else {
      toast({ title: '✅ Token válido', description: `Conta MP: ${(data as any).nickname}` });
    }
  };

  const handleConnect = async () => {
    if (!currentStore?.id || !currentAccount?.id) return;
    if (!conn.access_token) {
      toast({ variant: 'destructive', title: 'Informe o Access Token' });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('mp-connection', {
      body: {
        action: 'connect',
        store_id: currentStore.id,
        account_id: currentAccount.id,
        access_token: conn.access_token,
        public_key: conn.public_key,
        environment: conn.environment,
        enabled_methods: conn.enabled_methods,
        point_device_id: conn.point_device_id,
        point_device_name: conn.point_device_name,
        credit_fee_percent: Number(conn.credit_fee_percent) || 0,
        debit_fee_percent: Number(conn.debit_fee_percent) || 0,
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast({ variant: 'destructive', title: 'Erro ao conectar', description: (data as any)?.error || error?.message });
      return;
    }
    toast({ title: '🚀 Mercado Pago conectado!', description: `Conta: ${(data as any).nickname}` });
    setConn({ ...conn, status: 'connected', nickname: (data as any).nickname });
  };

  const handleDisconnect = async () => {
    if (!currentStore?.id) return;
    if (!confirm('Tem certeza que deseja desconectar o Mercado Pago desta loja?')) return;
    setSaving(true);
    await supabase.functions.invoke('mp-connection', {
      body: { action: 'disconnect', store_id: currentStore.id },
    });
    setSaving(false);
    setConn({ environment: 'production', status: 'disconnected', enabled_methods: ['pix', 'credit_card', 'debit_card'] });
    toast({ title: 'Mercado Pago desconectado' });
  };

  const handleListDevices = async () => {
    if (!currentStore?.id) return;
    setLoadingDevices(true);
    const { data, error } = await supabase.functions.invoke('mp-connection', {
      body: { action: 'list_devices', store_id: currentStore.id },
    });
    setLoadingDevices(false);
    if (error || (data as any)?.error) {
      toast({ variant: 'destructive', title: 'Erro ao listar maquininhas', description: (data as any)?.error || error?.message });
      return;
    }
    const list = (data as any)?.devices?.devices || [];
    setDevices(list);
    if (list.length === 0) toast({ title: 'Nenhuma maquininha encontrada', description: 'Pareie sua Point Smart/Mini com o app Mercado Pago primeiro.' });
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/app/integrations')} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="flex items-start gap-4">
        <div className="shrink-0"><MercadoPagoLogo className="h-16 w-16" /></div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Mercado Pago</h1>
            {conn.status === 'connected' ? (
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> Conectado{conn.nickname ? ` · ${conn.nickname}` : ''}
              </Badge>
            ) : (
              <Badge variant="outline">Desconectado</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Configure as credenciais desta loja ({currentStore?.name}) para receber pagamentos via PIX, cartão e maquininha Point.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciais da loja</CardTitle>
          <CardDescription className="text-xs">
            Acesse <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer" className="text-primary underline">mercadopago.com.br/developers</a> → Suas integrações → Crie uma aplicação → Credenciais de produção. Copie o Access Token e a Public Key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Access Token *</Label>
              <Input
                type="password"
                placeholder="APP_USR-..."
                value={conn.access_token || ''}
                onChange={e => setConn({ ...conn, access_token: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Public Key</Label>
              <Input
                placeholder="APP_USR-... (opcional)"
                value={conn.public_key || ''}
                onChange={e => setConn({ ...conn, public_key: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Ambiente</Label>
            <Select value={conn.environment || 'production'} onValueChange={v => setConn({ ...conn, environment: v as any })}>
              <SelectTrigger className="mt-1 max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Produção (cobranças reais)</SelectItem>
                <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />
          <div>
            <Label className="text-xs">Métodos de pagamento ativos</Label>
            <div className="grid sm:grid-cols-3 gap-2 mt-2">
              {[
                { id: 'pix', label: 'PIX' },
                { id: 'credit_card', label: 'Cartão de crédito' },
                { id: 'debit_card', label: 'Cartão de débito' },
              ].map(m => (
                <label key={m.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card cursor-pointer hover:bg-muted/40">
                  <Switch
                    checked={(conn.enabled_methods || []).includes(m.id)}
                    onCheckedChange={() => toggleMethod(m.id)}
                  />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />
          <div>
            <Label className="text-xs">Taxas do Mercado Pago (descontadas automaticamente das vendas no cartão)</Label>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs text-muted-foreground">Taxa Crédito (%)</Label>
                <Input
                  type="number" min={0} max={100} step={0.01}
                  value={conn.credit_fee_percent ?? 0}
                  onChange={e => setConn({ ...conn, credit_fee_percent: Number(e.target.value) })}
                  className="mt-1"
                  placeholder="ex: 4.99"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Taxa Débito (%)</Label>
                <Input
                  type="number" min={0} max={100} step={0.01}
                  value={conn.debit_fee_percent ?? 0}
                  onChange={e => setConn({ ...conn, debit_fee_percent: Number(e.target.value) })}
                  className="mt-1"
                  placeholder="ex: 1.99"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Estas taxas serão usadas no PDV e e-commerce para calcular o valor líquido recebido.</p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
              Testar token
            </Button>
            <Button onClick={handleConnect} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {conn.status === 'connected' ? 'Salvar alterações' : 'Conectar Mercado Pago'}
            </Button>
            {conn.status === 'connected' && (
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={saving} className="gap-1.5">
                <Power className="h-3.5 w-3.5" /> Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {conn.status === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" /> Maquininha Point (opcional)
            </CardTitle>
            <CardDescription className="text-xs">
              Se você tem uma Point Smart ou Point Mini do Mercado Pago, vincule-a aqui para cobrar no cartão diretamente pelo PDV. Pareie a maquininha no app oficial do MP antes de listar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleListDevices} disabled={loadingDevices} className="gap-1.5">
                {loadingDevices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                Buscar maquininhas pareadas
              </Button>
            </div>

            {devices.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Selecione a maquininha desta loja</Label>
                <div className="grid gap-2">
                  {devices.map((d: any) => (
                    <label key={d.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${conn.point_device_id === d.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}>
                      <input
                        type="radio"
                        name="point"
                        checked={conn.point_device_id === d.id}
                        onChange={() => setConn({ ...conn, point_device_id: d.id, point_device_name: d.operating_mode || d.id })}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{d.id}</p>
                        <p className="text-xs text-muted-foreground">{d.operating_mode || 'Point'} · {d.store_id || 'sem loja MP'}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <Button size="sm" onClick={handleConnect} disabled={saving} className="gap-1.5 mt-2">
                  <Save className="h-3.5 w-3.5" /> Salvar maquininha
                </Button>
              </div>
            )}

            {conn.point_device_id && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
                ✅ Maquininha ativa: <span className="font-mono">{conn.point_device_id}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
