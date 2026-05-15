import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plug, ShieldCheck, AlertCircle, Trash2, Truck, Save } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const CARRIERS = [
  { id: 'correios_pac', name: 'Correios PAC', desc: 'Econômico (5-10 dias úteis)' },
  { id: 'correios_sedex', name: 'Correios SEDEX', desc: 'Expresso (1-3 dias úteis)' },
  { id: 'jadlog', name: 'Jadlog .Package', desc: 'Bom custo-benefício nacional' },
  { id: 'loggi', name: 'Loggi', desc: 'Same-day em capitais' },
  { id: 'azul_cargo', name: 'Azul Cargo Express', desc: 'Aéreo nacional' },
  { id: 'jt', name: 'J&T Express', desc: 'Internacional/nacional' },
  { id: 'latam_cargo', name: 'LATAM Cargo', desc: 'Aéreo expresso' },
  { id: 'buslog', name: 'Buslog', desc: 'Rodoviário interestadual' },
];

export default function MelhorEnvioIntegration() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [hasGlobalCreds, setHasGlobalCreds] = useState(false);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [originZip, setOriginZip] = useState('');
  const [weight, setWeight] = useState(500);
  const [length, setLength] = useState(20);
  const [width, setWidth] = useState(15);
  const [height, setHeight] = useState(10);
  const [markup, setMarkup] = useState(0);

  useEffect(() => { void load(); }, [currentAccount?.id]);

  const load = async () => {
    if (!currentAccount?.id) return;
    setLoading(true);
    const [conn, creds] = await Promise.all([
      (supabase as any).from('melhor_envio_connections').select('*').eq('account_id', currentAccount.id).maybeSingle(),
      (supabase as any).from('melhor_envio_global_credentials').select('id').limit(1).maybeSingle(),
    ]);
    setConnection(conn.data);
    setHasGlobalCreds(!!creds.data);
    if (conn.data) {
      setEnabled(conn.data.enabled_carriers || []);
      setOriginZip(conn.data.origin_zipcode || '');
      setWeight(conn.data.default_weight_grams || 500);
      setLength(conn.data.default_length_cm || 20);
      setWidth(conn.data.default_width_cm || 15);
      setHeight(conn.data.default_height_cm || 10);
      setMarkup(Number(conn.data.markup_percent) || 0);
    }
    setLoading(false);
  };

  const handleConnect = async () => {
    if (!hasGlobalCreds) {
      toast({ variant: 'destructive', title: 'Aguardando configuração do administrador' });
      return;
    }
    setConnecting(true);
    const { data, error } = await supabase.functions.invoke('melhor-envio-connect', {
      body: { action: 'authorize', accountId: currentAccount?.id, returnUrl: `${window.location.origin}/app/integrations/melhor-envio` },
    });
    if (error || !data?.authorize_url) {
      toast({ variant: 'destructive', title: 'Erro ao iniciar conexão', description: error?.message || data?.error });
      setConnecting(false);
      return;
    }
    window.location.href = data.authorize_url;
  };

  const toggleCarrier = (id: string) => {
    setEnabled((prev) => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleSaveConfig = async () => {
    if (!connection) return;
    setSaving(true);
    const { error } = await (supabase as any).from('melhor_envio_connections').update({
      enabled_carriers: enabled,
      origin_zipcode: originZip,
      default_weight_grams: weight,
      default_length_cm: length,
      default_width_cm: width,
      default_height_cm: height,
      markup_percent: markup,
    }).eq('id', connection.id);
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message }); return; }
    toast({ title: 'Configurações salvas!' });
    void load();
  };

  const toggleActive = async (val: boolean) => {
    if (!connection) return;
    await (supabase as any).from('melhor_envio_connections').update({ is_active: val }).eq('id', connection.id);
    setConnection({ ...connection, is_active: val });
  };

  const handleDisconnect = async () => {
    if (!connection || !confirm('Desconectar Melhor Envio? Você perderá as cotações de frete no checkout.')) return;
    await (supabase as any).from('melhor_envio_connections').delete().eq('id', connection.id);
    setConnection(null);
    toast({ title: 'Desconectado' });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-[#0D6EFD] flex items-center justify-center text-white">
          <Truck className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Melhor Envio</h1>
          <p className="text-sm text-muted-foreground">Cotação multi-transportadora: Correios, Jadlog, Loggi, Azul, J&T e mais.</p>
        </div>
      </div>

      {!hasGlobalCreds && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Aguardando configuração do administrador</p>
              <p className="text-xs mt-1">A integração será liberada assim que o admin configurar as credenciais OAuth.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {connection ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" /> Conta conectada
                </CardTitle>
                <Switch checked={connection.is_active} onCheckedChange={toggleActive} />
              </div>
              <CardDescription>{connection.user_name || connection.user_email || 'Conta Melhor Envio'}</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transportadoras ativas</CardTitle>
              <CardDescription>Marque as opções que deseja oferecer no checkout do seu e-commerce.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CARRIERS.map((c) => (
                <div key={c.id} className="flex items-start justify-between rounded-lg border p-3 hover:bg-muted/30">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                  <Switch checked={enabled.includes(c.id)} onCheckedChange={() => toggleCarrier(c.id)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Origem e dimensões padrão</CardTitle>
              <CardDescription>Usado quando o produto não tem peso/dimensão cadastrados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><Label className="text-xs">CEP de origem</Label><Input value={originZip} onChange={(e) => setOriginZip(e.target.value)} placeholder="01310-100" maxLength={9} /></div>
                <div><Label className="text-xs">Peso padrão (g)</Label><Input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Markup (%)</Label><Input type="number" step="0.1" value={markup} onChange={(e) => setMarkup(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Comprimento (cm)</Label><Input type="number" value={length} onChange={(e) => setLength(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Largura (cm)</Label><Input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Altura (cm)</Label><Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} /></div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar configurações
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDisconnect} className="gap-2 ml-auto">
                  <Trash2 className="h-4 w-4" /> Desconectar
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Conectar sua conta Melhor Envio</CardTitle>
            <CardDescription>Crie uma conta grátis em melhorenvio.com.br e conecte aqui. Sem mensalidade — você só paga o frete que usar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleConnect} disabled={connecting || !hasGlobalCreds} className="gap-2">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Conectar Melhor Envio
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
