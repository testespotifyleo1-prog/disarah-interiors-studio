import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Zap, Trash2, AlertCircle, Search } from 'lucide-react';

export default function UberDirectIntegration() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [fetchingCnpj, setFetchingCnpj] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [hasGlobalCreds, setHasGlobalCreds] = useState(false);
  const [form, setForm] = useState({
    business_name: '', cnpj: '', contact_phone: '', contact_email: '',
    street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipcode: '',
    max_delivery_radius_km: 15, max_weight_kg: 30, hours_start: '08:00', hours_end: '22:00',
    is_active: false,
  });

  const formatCep = (v: string) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
  const formatCnpj = (v: string) => v.replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18);

  const lookupCep = async (cepValue: string) => {
    const n = cepValue.replace(/\D/g, '');
    if (n.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${n}/json/`);
      const data = await res.json();
      if (data.erro) { toast({ variant: 'destructive', title: 'CEP não encontrado' }); return; }
      setForm(p => ({
        ...p,
        street: data.logradouro || p.street,
        neighborhood: data.bairro || p.neighborhood,
        city: data.localidade || p.city,
        state: data.uf || p.state,
      }));
      toast({ title: 'Endereço preenchido pelo CEP' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao consultar CEP' });
    } finally { setFetchingCep(false); }
  };

  const lookupCnpj = async (cnpjValue: string) => {
    const n = cnpjValue.replace(/\D/g, '');
    if (n.length !== 14) return;
    setFetchingCnpj(true);
    try {
      const res = await fetch(`https://open.cnpja.com/office/${n}`);
      if (!res.ok) throw new Error('Falha');
      const data = await res.json();
      const addr = data.address || {};
      setForm(p => ({
        ...p,
        business_name: p.business_name || data.company?.name || '',
        contact_phone: p.contact_phone || (data.phones?.[0] ? `(${data.phones[0].area}) ${data.phones[0].number}` : ''),
        contact_email: p.contact_email || data.emails?.[0]?.address || '',
        street: p.street || `${addr.street || ''} ${addr.details || ''}`.trim(),
        number: p.number || String(addr.number || ''),
        neighborhood: p.neighborhood || addr.district || '',
        city: p.city || addr.city || '',
        state: p.state || addr.state || '',
        zipcode: p.zipcode || formatCep(String(addr.zip || '')),
      }));
      toast({ title: 'Dados preenchidos pelo CNPJ' });
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível consultar o CNPJ', description: 'Preencha manualmente.' });
    } finally { setFetchingCnpj(false); }
  };

  useEffect(() => { void load(); }, [currentAccount?.id]);

  const load = async () => {
    if (!currentAccount?.id) return;
    setLoading(true);
    const [conn, creds] = await Promise.all([
      (supabase as any).from('uber_direct_connections').select('*').eq('account_id', currentAccount.id).maybeSingle(),
      (supabase as any).from('uber_direct_global_credentials').select('id').limit(1).maybeSingle(),
    ]);
    setHasGlobalCreds(!!creds.data);
    if (conn.data) {
      setConnection(conn.data);
      const addr = conn.data.pickup_address || {};
      const hours = conn.data.operating_hours || {};
      setForm({
        business_name: conn.data.business_name || '',
        cnpj: conn.data.cnpj || '',
        contact_phone: conn.data.contact_phone || '',
        contact_email: conn.data.contact_email || '',
        street: addr.street || '', number: addr.number || '', complement: addr.complement || '',
        neighborhood: addr.neighborhood || '', city: addr.city || '', state: addr.state || '', zipcode: addr.zipcode || '',
        max_delivery_radius_km: conn.data.max_delivery_radius_km || 15,
        max_weight_kg: Number(conn.data.max_weight_kg) || 30,
        hours_start: hours.start || '08:00', hours_end: hours.end || '22:00',
        is_active: !!conn.data.is_active,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.business_name || !form.cnpj || !form.contact_phone || !form.zipcode) {
      toast({ variant: 'destructive', title: 'Preencha razão social, CNPJ, telefone e CEP' });
      return;
    }
    setSaving(true);
    const payload = {
      account_id: currentAccount?.id,
      business_name: form.business_name,
      cnpj: form.cnpj,
      contact_phone: form.contact_phone,
      contact_email: form.contact_email || null,
      pickup_address: {
        street: form.street, number: form.number, complement: form.complement,
        neighborhood: form.neighborhood, city: form.city, state: form.state, zipcode: form.zipcode,
      },
      max_delivery_radius_km: form.max_delivery_radius_km,
      max_weight_kg: form.max_weight_kg,
      operating_hours: { start: form.hours_start, end: form.hours_end },
      is_active: form.is_active,
    };
    const { error } = connection
      ? await (supabase as any).from('uber_direct_connections').update(payload).eq('id', connection.id)
      : await (supabase as any).from('uber_direct_connections').insert(payload);
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message }); return; }
    toast({ title: 'Uber Direct configurado!' });
    void load();
  };

  const handleDelete = async () => {
    if (!connection || !confirm('Remover configuração do Uber Direct?')) return;
    await (supabase as any).from('uber_direct_connections').delete().eq('id', connection.id);
    setConnection(null);
    toast({ title: 'Removido' });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-black flex items-center justify-center text-white">
          <Zap className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Uber Direct</h1>
          <p className="text-sm text-muted-foreground">Entrega on-demand local (motoboy/carro Uber). Cliente compra de manhã, recebe à tarde.</p>
        </div>
      </div>

      {!hasGlobalCreds && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Aguardando configuração do administrador</p>
              <p className="text-xs mt-1">A integração Uber Direct será liberada após o admin concluir o cadastro comercial junto à Uber.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dados da empresa</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Ativo</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => f('is_active', v)} disabled={!hasGlobalCreds} />
            </div>
          </div>
          <CardDescription>Estes dados são usados pela Uber para faturar a empresa de entregas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Razão social *</Label><Input value={form.business_name} onChange={(e) => f('business_name', e.target.value)} /></div>
            <div>
              <Label className="text-xs">CNPJ *</Label>
              <div className="relative">
                <Input
                  value={form.cnpj}
                  onChange={(e) => f('cnpj', formatCnpj(e.target.value))}
                  onBlur={(e) => lookupCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
                {fetchingCnpj && <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Preenche razão social e endereço automaticamente.</p>
            </div>
            <div><Label className="text-xs">Telefone de contato *</Label><Input value={form.contact_phone} onChange={(e) => f('contact_phone', e.target.value)} /></div>
            <div><Label className="text-xs">E-mail de contato</Label><Input type="email" value={form.contact_email} onChange={(e) => f('contact_email', e.target.value)} /></div>
          </div>

          <div className="pt-2"><h3 className="text-sm font-semibold mb-2">Endereço de coleta</h3>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">CEP *</Label>
                <div className="relative">
                  <Input
                    value={form.zipcode}
                    onChange={(e) => f('zipcode', formatCep(e.target.value))}
                    onBlur={(e) => lookupCep(e.target.value)}
                    placeholder="00000-000"
                  />
                  {fetchingCep && <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                </div>
              </div>
              <div className="sm:col-span-3"><Label className="text-xs">Rua</Label><Input value={form.street} onChange={(e) => f('street', e.target.value)} /></div>
              <div><Label className="text-xs">Número</Label><Input value={form.number} onChange={(e) => f('number', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Complemento</Label><Input value={form.complement} onChange={(e) => f('complement', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Bairro</Label><Input value={form.neighborhood} onChange={(e) => f('neighborhood', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Cidade</Label><Input value={form.city} onChange={(e) => f('city', e.target.value)} /></div>
              <div><Label className="text-xs">UF</Label><Input value={form.state} onChange={(e) => f('state', e.target.value)} maxLength={2} /></div>
            </div>
          </div>

          <div className="pt-2"><h3 className="text-sm font-semibold mb-2">Limites de operação</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><Label className="text-xs">Raio máx (km)</Label><Input type="number" value={form.max_delivery_radius_km} onChange={(e) => f('max_delivery_radius_km', Number(e.target.value))} /></div>
              <div><Label className="text-xs">Peso máx (kg)</Label><Input type="number" step="0.1" value={form.max_weight_kg} onChange={(e) => f('max_weight_kg', Number(e.target.value))} /></div>
              <div><Label className="text-xs">Início</Label><Input type="time" value={form.hours_start} onChange={(e) => f('hours_start', e.target.value)} /></div>
              <div><Label className="text-xs">Fim</Label><Input type="time" value={form.hours_end} onChange={(e) => f('hours_end', e.target.value)} /></div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <strong>💳 Cobrança:</strong> Cada entrega Uber Direct é faturada pelo administrador do sistema (master account Uber) e repassada na sua fatura mensal.
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || !hasGlobalCreds} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            {connection && (
              <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2 ml-auto">
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
