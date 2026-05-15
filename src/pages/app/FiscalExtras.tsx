import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileX2, Truck, Inbox, HardDrive, Loader2, Plus, RefreshCw, Download } from 'lucide-react';

export default function FiscalExtras() {
  return (
    <div className="container max-w-7xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Ferramentas Fiscais Avançadas</h1>
        <p className="text-sm text-muted-foreground">Inutilização, MDF-e, Manifestação do Destinatário e Backup de XMLs.</p>
      </div>

      <Tabs defaultValue="invalidations">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="invalidations"><FileX2 className="h-4 w-4 mr-2" />Inutilização</TabsTrigger>
          <TabsTrigger value="mdfe"><Truck className="h-4 w-4 mr-2" />MDF-e</TabsTrigger>
          <TabsTrigger value="destined"><Inbox className="h-4 w-4 mr-2" />NF-es Destinadas</TabsTrigger>
          <TabsTrigger value="backup"><HardDrive className="h-4 w-4 mr-2" />Backup XMLs</TabsTrigger>
        </TabsList>

        <TabsContent value="invalidations"><InvalidationsTab /></TabsContent>
        <TabsContent value="mdfe"><MdfeTab /></TabsContent>
        <TabsContent value="destined"><DestinedTab /></TabsContent>
        <TabsContent value="backup"><BackupTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================ INUTILIZAÇÃO ============================
function InvalidationsTab() {
  const { currentStore } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    modelo: '65', serie: '1', numero_inicial: '', numero_final: '', justificativa: ''
  });

  const load = async () => {
    if (!currentStore) return;
    const { data } = await supabase.from('fiscal_invalidations')
      .select('*').eq('store_id', currentStore.id).order('created_at', { ascending: false });
    setList(data || []);
  };
  useEffect(() => { load(); }, [currentStore?.id]);

  const submit = async () => {
    if (!currentStore) return;
    if (form.justificativa.length < 15) return toast.error('Justificativa precisa de 15+ caracteres');
    if (!form.numero_inicial || !form.numero_final) return toast.error('Informe os números');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('invalidate-fiscal-numbering', {
        body: {
          store_id: currentStore.id,
          modelo: form.modelo,
          serie: Number(form.serie),
          numero_inicial: Number(form.numero_inicial),
          numero_final: Number(form.numero_final),
          justificativa: form.justificativa,
        }
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Inutilização registrada na SEFAZ');
      setOpen(false);
      setForm({ modelo: '65', serie: '1', numero_inicial: '', numero_final: '', justificativa: '' });
      load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao inutilizar');
    } finally { setLoading(false); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Inutilização de Numeração</CardTitle>
          <CardDescription>Quando uma NFC-e/NF-e é rejeitada definitivamente, inutilize a numeração na SEFAZ.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Inutilização</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Inutilizar faixa de numeração</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Modelo</Label>
                  <Select value={form.modelo} onValueChange={v => setForm({ ...form, modelo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="65">65 - NFC-e</SelectItem>
                      <SelectItem value="55">55 - NF-e</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Série</Label>
                  <Input type="number" value={form.serie} onChange={e => setForm({ ...form, serie: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Número inicial</Label><Input type="number" value={form.numero_inicial} onChange={e => setForm({ ...form, numero_inicial: e.target.value })} /></div>
                <div><Label>Número final</Label><Input type="number" value={form.numero_final} onChange={e => setForm({ ...form, numero_final: e.target.value })} /></div>
              </div>
              <div>
                <Label>Justificativa (mín. 15 caracteres)</Label>
                <Textarea rows={3} value={form.justificativa} onChange={e => setForm({ ...form, justificativa: e.target.value })} placeholder="Ex: Falha técnica na transmissão da nota, número saltado." />
                <p className="text-xs text-muted-foreground mt-1">{form.justificativa.length}/255</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Inutilizar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma inutilização registrada.</p>
        ) : (
          <div className="space-y-2">
            {list.map(i => (
              <div key={i.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">Modelo {i.modelo} • Série {i.serie} • Nº {i.numero_inicial}–{i.numero_final}</div>
                  <div className="text-sm text-muted-foreground">{i.justificativa}</div>
                  {i.protocolo && <div className="text-xs">Protocolo: {i.protocolo}</div>}
                </div>
                <Badge variant={i.status === 'completed' ? 'default' : i.status === 'error' ? 'destructive' : 'secondary'}>{i.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================ MDF-e ============================
function MdfeTab() {
  const { currentStore } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [form, setForm] = useState({
    uf_carregamento: '', uf_descarregamento: '',
    municipio_carregamento: '', municipio_descarregamento: '',
    veiculo_placa: '', veiculo_uf: '', veiculo_tara: '', veiculo_rntrc: '',
    motorista_nome: '', motorista_cpf: '',
    peso_total: '', valor_total: '',
    chaves_text: '',
  });

  const load = async () => {
    if (!currentStore) return;
    const { data } = await supabase.from('mdfe_documents')
      .select('*').eq('store_id', currentStore.id).order('created_at', { ascending: false });
    setList(data || []);
    const { data: d } = await supabase.from('drivers').select('*').eq('account_id', currentStore.account_id);
    setDrivers(d || []);
  };
  useEffect(() => { load(); }, [currentStore?.id]);

  const submit = async () => {
    if (!currentStore) return;
    const chaves = form.chaves_text.split(/[\s,;\n]+/).map(s => s.trim()).filter(s => s.length === 44);
    if (chaves.length === 0) return toast.error('Informe pelo menos uma chave de NF-e (44 dígitos)');
    if (!form.uf_carregamento || !form.uf_descarregamento) return toast.error('Informe UFs');
    if (!form.veiculo_placa || !form.motorista_nome || !form.motorista_cpf) return toast.error('Informe veículo e motorista');

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('emit-mdfe', {
        body: {
          store_id: currentStore.id,
          uf_carregamento: form.uf_carregamento.toUpperCase(),
          uf_descarregamento: form.uf_descarregamento.toUpperCase(),
          municipio_carregamento: form.municipio_carregamento,
          municipio_descarregamento: form.municipio_descarregamento,
          veiculo_placa: form.veiculo_placa,
          veiculo_uf: form.veiculo_uf.toUpperCase(),
          veiculo_tara: Number(form.veiculo_tara) || 0,
          veiculo_rntrc: form.veiculo_rntrc,
          motorista_nome: form.motorista_nome,
          motorista_cpf: form.motorista_cpf,
          peso_total: Number(form.peso_total) || 0,
          valor_total: Number(form.valor_total) || 0,
          documentos_vinculados: chaves.map(c => ({ chave: c })),
        }
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('MDF-e enviado para autorização');
      setOpen(false); load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao emitir MDF-e');
    } finally { setLoading(false); }
  };

  const cancelMdfe = async (id: string) => {
    const justif = prompt('Justificativa do cancelamento (mín. 15 caracteres):');
    if (!justif || justif.length < 15) return;
    try {
      const { data, error } = await supabase.functions.invoke('cancel-mdfe', { body: { mdfe_id: id, justificativa: justif } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('MDF-e cancelado'); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const closeMdfe = async (id: string) => {
    if (!confirm('Encerrar este MDF-e? Faça isso ao chegar no destino.')) return;
    try {
      const { data, error } = await supabase.functions.invoke('close-mdfe', { body: { mdfe_id: id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('MDF-e encerrado'); load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>MDF-e (Manifesto Eletrônico)</CardTitle>
          <CardDescription>Obrigatório para transferências entre lojas e entregas próprias com veículo.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Emitir MDF-e</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Emitir MDF-e</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>UF Origem</Label><Input maxLength={2} value={form.uf_carregamento} onChange={e => setForm({ ...form, uf_carregamento: e.target.value })} placeholder="MS" /></div>
                <div><Label>UF Destino</Label><Input maxLength={2} value={form.uf_descarregamento} onChange={e => setForm({ ...form, uf_descarregamento: e.target.value })} placeholder="SP" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Município Origem</Label><Input value={form.municipio_carregamento} onChange={e => setForm({ ...form, municipio_carregamento: e.target.value })} /></div>
                <div><Label>Município Destino</Label><Input value={form.municipio_descarregamento} onChange={e => setForm({ ...form, municipio_descarregamento: e.target.value })} /></div>
              </div>
              <div className="border-t pt-3 space-y-3">
                <Label className="font-semibold">Veículo</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Placa</Label><Input value={form.veiculo_placa} onChange={e => setForm({ ...form, veiculo_placa: e.target.value.toUpperCase() })} /></div>
                  <div><Label>UF</Label><Input maxLength={2} value={form.veiculo_uf} onChange={e => setForm({ ...form, veiculo_uf: e.target.value })} /></div>
                  <div><Label>Tara (kg)</Label><Input type="number" value={form.veiculo_tara} onChange={e => setForm({ ...form, veiculo_tara: e.target.value })} /></div>
                </div>
                <div><Label>RNTRC (opcional)</Label><Input value={form.veiculo_rntrc} onChange={e => setForm({ ...form, veiculo_rntrc: e.target.value })} /></div>
              </div>
              <div className="border-t pt-3 space-y-3">
                <Label className="font-semibold">Motorista</Label>
                {drivers.length > 0 && (
                  <Select onValueChange={v => {
                    const d = drivers.find(x => x.id === v);
                    if (d) setForm({ ...form, motorista_nome: d.name || '', motorista_cpf: d.cpf || '' });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar do cadastro" /></SelectTrigger>
                    <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome</Label><Input value={form.motorista_nome} onChange={e => setForm({ ...form, motorista_nome: e.target.value })} /></div>
                  <div><Label>CPF</Label><Input value={form.motorista_cpf} onChange={e => setForm({ ...form, motorista_cpf: e.target.value })} /></div>
                </div>
              </div>
              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><Label>Peso total (kg)</Label><Input type="number" step="0.001" value={form.peso_total} onChange={e => setForm({ ...form, peso_total: e.target.value })} /></div>
                <div><Label>Valor total da carga (R$)</Label><Input type="number" step="0.01" value={form.valor_total} onChange={e => setForm({ ...form, valor_total: e.target.value })} /></div>
              </div>
              <div>
                <Label>Chaves das NF-es (44 dígitos cada, uma por linha)</Label>
                <Textarea rows={4} value={form.chaves_text} onChange={e => setForm({ ...form, chaves_text: e.target.value })} placeholder="35200612345678000123550010000000011000000010" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Emitir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum MDF-e emitido.</p>
        ) : (
          <div className="space-y-2">
            {list.map(m => (
              <div key={m.id} className="border rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-medium">{m.uf_carregamento} → {m.uf_descarregamento} • Placa {m.veiculo_placa}</div>
                  <div className="text-sm text-muted-foreground">{m.motorista_nome} • {(m.documentos_vinculados || []).length} doc(s) • R$ {Number(m.valor_total || 0).toFixed(2)}</div>
                  {m.protocolo && <div className="text-xs">Prot: {m.protocolo}</div>}
                  {m.error_message && <div className="text-xs text-destructive">{m.error_message}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.status === 'authorized' ? 'default' : m.status === 'error' ? 'destructive' : m.status === 'closed' ? 'secondary' : 'outline'}>{m.status}</Badge>
                  {m.pdf_url && <Button size="sm" variant="ghost" asChild><a href={m.pdf_url} target="_blank" rel="noreferrer"><Download className="h-3 w-3" /></a></Button>}
                  {m.status === 'authorized' && <Button size="sm" variant="outline" onClick={() => closeMdfe(m.id)}>Encerrar</Button>}
                  {['authorized', 'processing'].includes(m.status) && <Button size="sm" variant="ghost" onClick={() => cancelMdfe(m.id)}>Cancelar</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================ NFE DESTINADAS ============================
function DestinedTab() {
  const { currentStore } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!currentStore) return;
    const { data } = await supabase.from('nfe_destination_manifest')
      .select('*').eq('store_id', currentStore.id).order('data_emissao', { ascending: false });
    setList(data || []);
  };
  useEffect(() => { load(); }, [currentStore?.id]);

  const sync = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-destined-nfes', { body: { store_id: currentStore.id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${(data as any).new} novas / ${(data as any).total} no total`);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const manifest = async (id: string, tipo: string) => {
    let justif: string | undefined;
    if (tipo === 'nao_realizada') {
      justif = prompt('Justificativa (mín. 15 caracteres):') || undefined;
      if (!justif || justif.length < 15) return toast.error('Justificativa inválida');
    }
    try {
      const { data, error } = await supabase.functions.invoke('manifest-nfe-destination', {
        body: { manifest_id: id, tipo, justificativa: justif }
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Manifestação registrada'); load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>NF-es Destinadas</CardTitle>
          <CardDescription>NF-es emitidas contra o CNPJ desta loja. Manifeste para evitar uso indevido.</CardDescription>
        </div>
        <Button onClick={sync} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Sincronizar SEFAZ</Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma NF-e destinada. Clique em "Sincronizar".</p>
        ) : (
          <div className="space-y-2">
            {list.map(n => (
              <div key={n.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{n.nome_emitente || n.cnpj_emitente}</div>
                    <div className="text-sm text-muted-foreground">NF-e {n.numero_nfe}/{n.serie_nfe} • R$ {Number(n.valor_nfe || 0).toFixed(2)} • {n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : ''}</div>
                    <div className="text-xs font-mono break-all">{n.chave_nfe}</div>
                  </div>
                  <Badge variant={n.status === 'manifested' ? 'default' : n.status === 'error' ? 'destructive' : 'outline'}>
                    {n.status === 'manifested' ? n.tipo_manifestacao : n.status}
                  </Badge>
                </div>
                {n.status !== 'manifested' && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => manifest(n.id, 'confirmacao')}>Confirmar Operação</Button>
                    <Button size="sm" variant="outline" onClick={() => manifest(n.id, 'ciencia')}>Ciência</Button>
                    <Button size="sm" variant="outline" onClick={() => manifest(n.id, 'desconhecimento')}>Desconhecer</Button>
                    <Button size="sm" variant="ghost" onClick={() => manifest(n.id, 'nao_realizada')}>Não Realizada</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================ BACKUP XMLs ============================
function BackupTab() {
  const { currentAccount } = useAuth();
  const [stats, setStats] = useState({ total: 0, lastDate: '' });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!currentAccount) return;
    const { count } = await supabase.from('fiscal_xml_backups')
      .select('*', { count: 'exact', head: true }).eq('account_id', currentAccount.id);
    const { data: last } = await supabase.from('fiscal_xml_backups')
      .select('backed_up_at').eq('account_id', currentAccount.id)
      .order('backed_up_at', { ascending: false }).limit(1);
    setStats({ total: count || 0, lastDate: last?.[0]?.backed_up_at || '' });
  };
  useEffect(() => { load(); }, [currentAccount?.id]);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('backup-fiscal-xmls', {
        body: { account_id: currentAccount?.id }
      });
      if (error) throw error;
      const r = data as any;
      toast.success(`Backup: ${r.saved} novos, ${r.skipped} já existentes, ${r.errors} erros`);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup Automático de XMLs</CardTitle>
        <CardDescription>A Receita exige guarda dos XMLs por 5 anos. Aqui ficam armazenados em cofre privado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">XMLs armazenados</div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.lastDate ? new Date(stats.lastDate).toLocaleDateString('pt-BR') : '—'}</div>
            <div className="text-sm text-muted-foreground">Último backup</div>
          </div>
        </div>
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDrive className="h-4 w-4 mr-2" />}
          Executar backup agora
        </Button>
        <p className="text-xs text-muted-foreground">O sistema também roda backup automático diário. Cada XML é salvo no caminho <code>{`{conta}/{ano}/{mês}/{chave}.xml`}</code>.</p>
      </CardContent>
    </Card>
  );
}
