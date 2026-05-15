import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, Loader2, Building2, Upload } from 'lucide-react';
import SmartPagination from '@/components/SmartPagination';

interface Supplier {
  id: string;
  account_id: string;
  cnpj: string;
  name: string;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  address_json: any;
  created_at: string;
}

const ITEMS_PER_PAGE = 50;

const emptyForm = {
  cnpj: '',
  name: '',
  trade_name: '',
  email: '',
  phone: '',
  delivery_days: '5',
  cep: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
};

export default function Suppliers() {
  const { user, currentAccount, userRole } = useAuth();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);

  const canManage = userRole && ['owner', 'admin', 'manager'].includes(userRole);

  const loadSuppliers = useCallback(async () => {
    if (!currentAccount) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('account_id', currentAccount.id)
      .order('name');
    if (error) {
      toast({ title: 'Erro ao carregar fornecedores', description: error.message, variant: 'destructive' });
    } else {
      setSuppliers(data || []);
    }
    setLoading(false);
  }, [currentAccount, toast]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.cnpj.includes(search) ||
    (s.trade_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [search]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    const addr = (s.address_json as any) || {};
    setForm({
      cnpj: s.cnpj || '',
      name: s.name || '',
      trade_name: s.trade_name || '',
      email: s.email || '',
      phone: s.phone || '',
      delivery_days: String((s as any).delivery_days ?? '5'),
      cep: addr.cep || '',
      street: addr.street || '',
      number: addr.number || '',
      complement: addr.complement || '',
      district: addr.district || '',
      city: addr.city || '',
      state: addr.state || '',
    });
    setDialogOpen(true);
  };

  const lookupCnpj = async () => {
    const cnpjNumbers = form.cnpj.replace(/\D/g, '');
    if (cnpjNumbers.length !== 14) {
      toast({ title: 'CNPJ inválido', description: 'Digite um CNPJ com 14 dígitos.', variant: 'destructive' });
      return;
    }
    setLookingUpCnpj(true);
    try {
      const res = await fetch(`https://open.cnpja.com/office/${cnpjNumbers}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        name: data.company?.name || prev.name,
        trade_name: data.alias || data.company?.name || prev.trade_name,
        email: data.emails?.[0]?.address || prev.email,
        phone: data.phones?.[0] ? `(${data.phones[0].area}) ${data.phones[0].number}` : prev.phone,
        cep: data.address?.zip ? String(data.address.zip).padStart(8, '0') : prev.cep,
        street: data.address?.street || prev.street,
        number: data.address?.number || prev.number,
        complement: data.address?.details || prev.complement,
        district: data.address?.district || prev.district,
        city: data.address?.city || prev.city,
        state: data.address?.state || prev.state,
      }));
      toast({ title: 'CNPJ encontrado', description: 'Dados preenchidos automaticamente.' });
    } catch {
      toast({ title: 'Erro ao buscar CNPJ', variant: 'destructive' });
    } finally {
      setLookingUpCnpj(false);
    }
  };

  const lookupCep = async () => {
    const cepNumbers = form.cep.replace(/\D/g, '');
    if (cepNumbers.length !== 8) {
      toast({ title: 'CEP inválido', description: 'Digite um CEP com 8 dígitos.', variant: 'destructive' });
      return;
    }
    setLookingUpCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepNumbers}/json/`);
      const data = await res.json();
      if (data.erro) throw new Error();
      setForm(prev => ({
        ...prev,
        street: data.logradouro || prev.street,
        district: data.bairro || prev.district,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
      toast({ title: 'CEP encontrado' });
    } catch {
      toast({ title: 'CEP não encontrado', variant: 'destructive' });
    } finally {
      setLookingUpCep(false);
    }
  };

  const handleSave = async () => {
    if (!currentAccount) return;
    if (!form.cnpj.replace(/\D/g, '') || !form.name.trim()) {
      toast({ title: 'Preencha CNPJ e Razão Social', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const address_json = {
      cep: form.cep, street: form.street, number: form.number,
      complement: form.complement, district: form.district, city: form.city, state: form.state,
    };
    const payload = {
      account_id: currentAccount.id,
      cnpj: form.cnpj.replace(/\D/g, ''),
      name: form.name.trim(),
      trade_name: form.trade_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      delivery_days: parseInt(form.delivery_days) || 5,
      address_json,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('suppliers').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('suppliers').insert(payload));
    }

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: editing ? 'update' : 'create', entityType: 'supplier', entityId: editing?.id, details: { nome: payload.name } });
      toast({ title: editing ? 'Fornecedor atualizado' : 'Fornecedor cadastrado' });
      setDialogOpen(false);
      loadSuppliers();
    }
    setSaving(false);
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Excluir fornecedor "${s.name}"?`)) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', s.id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'delete', entityType: 'supplier', entityId: s.id, details: { nome: s.name } });
      toast({ title: 'Fornecedor excluído' });
      loadSuppliers();
    }
  };

  const formatCnpj = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 14);
    return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
            .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, '$1.$2.$3/$4-$5')
            .replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})$/, '$1.$2.$3/$4')
            .replace(/^(\d{2})(\d{3})(\d{0,3})$/, '$1.$2.$3')
            .replace(/^(\d{2})(\d{0,3})$/, '$1.$2');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground">{filtered.length} fornecedor(es)</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/app/suppliers/import"><Upload className="mr-2 h-4 w-4" /> CSV</Link>
            </Button>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ ou nome fantasia..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : paginated.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Nenhum fornecedor encontrado.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>Nome Fantasia</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    {canManage && <TableHead className="w-[100px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(s => {
                    const addr = (s.address_json as any) || {};
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.trade_name || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{formatCnpj(s.cnpj)}</TableCell>
                        <TableCell>{s.phone || '-'}</TableCell>
                        <TableCell>{addr.city ? `${addr.city}/${addr.state}` : '-'}</TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="mt-4">
                  <SmartPagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <div className="flex gap-2">
                  <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: formatCnpj(e.target.value) })} placeholder="00.000.000/0000-00" />
                  <Button type="button" variant="outline" size="icon" onClick={lookupCnpj} disabled={lookingUpCnpj}>
                    {lookingUpCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input value={form.trade_name} onChange={e => setForm({ ...form, trade_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prazo Entrega (dias úteis)</Label>
                <Input type="number" value={form.delivery_days} onChange={e => setForm({ ...form, delivery_days: e.target.value })} min="1" max="90" />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 text-foreground">Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="flex gap-2">
                    <Input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value.replace(/\D/g, '').slice(0, 8) })} placeholder="00000000" />
                    <Button type="button" variant="outline" size="icon" onClick={lookupCep} disabled={lookingUpCep}>
                      {lookingUpCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Rua</Label>
                  <Input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} maxLength={2} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
