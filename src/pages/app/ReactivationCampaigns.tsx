import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, MessageCircle, Plus, RefreshCw, Trash2, Send, Users, History, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function ReactivationCampaigns() {
  const { currentAccount, currentStore, stores } = useAuth() as any;
  const [tab, setTab] = useState('campaigns');
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => { if (currentAccount) load(); }, [currentAccount?.id]);

  const load = async () => {
    if (!currentAccount) return;
    setLoading(true);
    const { data } = await supabase
      .from('reactivation_campaigns')
      .select('*')
      .eq('account_id', currentAccount.id)
      .order('created_at', { ascending: false });
    setList(data || []); setLoading(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta campanha?')) return;
    await supabase.from('reactivation_campaigns').delete().eq('id', id);
    toast.success('Campanha excluída'); load();
  };

  const toggle = async (c: any) => {
    await supabase.from('reactivation_campaigns').update({ active: !c.active }).eq('id', c.id);
    load();
  };

  const run = async (c: any) => {
    setRunning(c.id);
    const { data, error } = await supabase.functions.invoke('run-reactivation-campaign', {
      body: { campaign_id: c.id, store_id: c.store_id || currentStore?.id },
    });
    setRunning(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Campanha enviada: ${data?.sent || 0} clientes (${data?.eligible || 0} elegíveis)`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Campanhas de Recompra</h1>
          <p className="text-sm text-muted-foreground">CRM ativo: reative clientes inativos via WhatsApp.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Nova campanha</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="campaigns"><MessageCircle className="h-3 w-3 mr-1" />Campanhas</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3 w-3 mr-1" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : list.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />Nenhuma campanha</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {list.map(c => (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold flex items-center gap-2">{c.name} {c.active ? <Badge variant="default">Ativa</Badge> : <Badge variant="secondary">Pausada</Badge>}</p>
                        <p className="text-xs text-muted-foreground">
                          <Users className="inline h-3 w-3 mr-1" />Inativos {c.inactive_days}+ dias · {c.channel.toUpperCase()}
                          {c.store_id ? ` · ${stores?.find((s: any) => s.id === c.store_id)?.name || 'Loja'}` : ' · Conta inteira'}
                          {Array.isArray(c.target_customer_ids) && c.target_customer_ids.length > 0 && ` · Lista: ${c.target_customer_ids.length}`}
                        </p>
                      </div>
                      <Switch checked={c.active} onCheckedChange={() => toggle(c)} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 italic">"{c.message_template}"</p>
                    {c.last_run_at && <p className="text-xs text-muted-foreground">Último envio: {new Date(c.last_run_at).toLocaleString('pt-BR')}</p>}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Editar</Button>
                      <Button size="sm" onClick={() => run(c)} disabled={running === c.id}>
                        {running === c.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                        Disparar agora
                      </Button>
                      <Button size="icon" variant="ghost" className="ml-auto" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <CampaignHistory campaigns={list} accountId={currentAccount?.id} />
        </TabsContent>
      </Tabs>

      <CampaignDialog open={creating || !!editing} existing={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
        accountId={currentAccount?.id} stores={stores || []} />
    </div>
  );
}

function CampaignHistory({ campaigns, accountId }: { campaigns: any[]; accountId?: string }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoading(true);
      const ids = campaigns.map(c => c.id);
      if (!ids.length) { setLogs([]); setLoading(false); return; }
      const { data } = await supabase
        .from('reactivation_log')
        .select('*, customers(name, phone), reactivation_campaigns(name)')
        .in('campaign_id', ids)
        .order('sent_at', { ascending: false })
        .limit(500);
      setLogs(data || []); setLoading(false);
    })();
  }, [accountId, campaigns.length]);

  const filtered = useMemo(() => logs.filter(l =>
    (statusFilter === 'all' || l.status === statusFilter) &&
    (campaignFilter === 'all' || l.campaign_id === campaignFilter)
  ), [logs, statusFilter, campaignFilter]);

  const counts = useMemo(() => ({
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status === 'failed').length,
  }), [logs]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="sent">Enviados ({counts.sent})</SelectItem>
            <SelectItem value="failed">Falhas ({counts.failed})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas campanhas</SelectItem>
            {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
      </div>
      {loading ? (
        <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Sem envios registrados</CardContent></Card>
      ) : (
        <div className="border rounded divide-y">
          {filtered.map(l => (
            <div key={l.id} className="px-3 py-2 flex items-center justify-between text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{l.customers?.name || 'Cliente'} · <span className="text-muted-foreground">{l.customers?.phone || '—'}</span></p>
                <p className="text-xs text-muted-foreground">{l.reactivation_campaigns?.name || 'Campanha'} · {new Date(l.sent_at).toLocaleString('pt-BR')}</p>
              </div>
              <Badge variant={l.status === 'sent' ? 'default' : 'destructive'}>{l.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignDialog({ open, existing, onClose, onSaved, accountId, stores }: any) {
  const [name, setName] = useState('');
  const [days, setDays] = useState(60);
  const [tpl, setTpl] = useState('Olá {{nome}}, faz tempo que não nos vemos! Que tal dar uma olhada nas novidades? 🎉');
  const [active, setActive] = useState(true);
  const [storeId, setStoreId] = useState<string>('');
  const [useList, setUseList] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name); setDays(existing.inactive_days); setTpl(existing.message_template);
      setActive(existing.active); setStoreId(existing.store_id || '');
      const list = Array.isArray(existing.target_customer_ids) ? existing.target_customer_ids : [];
      setUseList(list.length > 0); setSelectedCustomers(list);
    } else {
      setName(''); setDays(60); setTpl('Olá {{nome}}, faz tempo que não nos vemos! Que tal dar uma olhada nas novidades? 🎉');
      setActive(true); setStoreId(''); setUseList(false); setSelectedCustomers([]);
    }
    if (accountId) {
      supabase.from('customers').select('id, name, phone').eq('account_id', accountId).not('phone', 'is', null).order('name').limit(500)
        .then(({ data }) => setCustomers(data || []));
    }
  }, [open, existing?.id]);

  const filteredCustomers = useMemo(() =>
    !search ? customers.slice(0, 100)
      : customers.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)).slice(0, 100),
    [customers, search]);

  const toggleCustomer = (id: string) => {
    setSelectedCustomers(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const save = async () => {
    if (!name.trim() || !tpl.trim()) { toast.error('Preencha nome e mensagem'); return; }
    setBusy(true);
    const payload: any = {
      account_id: accountId, store_id: storeId || null, name, inactive_days: days,
      message_template: tpl, active, channel: 'whatsapp',
      target_customer_ids: useList && selectedCustomers.length ? selectedCustomers : null,
    };
    const { error } = existing
      ? await supabase.from('reactivation_campaigns').update(payload).eq('id', existing.id)
      : await supabase.from('reactivation_campaigns').insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Campanha salva'); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar' : 'Nova'} campanha</DialogTitle>
          <DialogDescription>Use {'{{nome}}'} para inserir o nome do cliente automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome interno</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Reativação 60d" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Loja (segmentação)</Label>
              <Select value={storeId || '__all'} onValueChange={(v) => setStoreId(v === '__all' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Conta inteira</SelectItem>
                  {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Inativos há (dias)</Label>
              <Input type="number" min={1} value={days} onChange={e => setDays(Number(e.target.value || 60))} />
            </div>
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea rows={3} value={tpl} onChange={e => setTpl(e.target.value)} />
          </div>
          <div className="border rounded p-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="cursor-pointer flex items-center gap-2">
                <Switch checked={useList} onCheckedChange={setUseList} />
                Disparar para lista específica de clientes
              </Label>
              {useList && <span className="text-xs text-muted-foreground">{selectedCustomers.length} selecionados</span>}
            </div>
            {useList && (
              <>
                <Input placeholder="Buscar nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} />
                <div className="max-h-48 overflow-y-auto scrollbar-thin border rounded">
                  {filteredCustomers.map(c => (
                    <label key={c.id} className="flex items-center gap-2 p-1.5 hover:bg-accent cursor-pointer text-sm">
                      <input type="checkbox" checked={selectedCustomers.includes(c.id)} onChange={() => toggleCustomer(c.id)} />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.phone}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Quando uma lista é definida, o filtro de inatividade é ignorado.</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><Label>Ativa</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
