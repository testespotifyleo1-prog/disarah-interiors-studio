import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isModuleDisabled, MODULE_BLOCKED_MESSAGE } from '@/utils/accountModules';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Pencil, Loader2, Upload, AlertCircle, Cake } from 'lucide-react';
import SmartPagination from '@/components/SmartPagination';
import { validateDocument } from '@/utils/cpfCnpj';
import type { Customer } from '@/types/database';

const PAGE_SIZE = 50;

interface AddressJson {
  street?: string; number?: string; complement?: string; district?: string;
  city?: string; cityCode?: string; state?: string; postalCode?: string;
  ie?: string;
  [key: string]: string | undefined;
}

const BRAZIL_STATES = [
  { value: 'AC', label: 'Acre' }, { value: 'AL', label: 'Alagoas' }, { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' }, { value: 'BA', label: 'Bahia' }, { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' }, { value: 'ES', label: 'Espírito Santo' }, { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' }, { value: 'MT', label: 'Mato Grosso' }, { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' }, { value: 'PA', label: 'Pará' }, { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' }, { value: 'PE', label: 'Pernambuco' }, { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' }, { value: 'RN', label: 'Rio Grande do Norte' }, { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' }, { value: 'RR', label: 'Roraima' }, { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' }, { value: 'SE', label: 'Sergipe' }, { value: 'TO', label: 'Tocantins' },
];

export default function Customers() {
  const { user, currentAccount, canEdit, isOwnerOrAdmin, userRole } = useAuth();
  const canManageCustomers = canEdit || userRole === 'seller';
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '', document: '', email: '', phone: '', birth_date: '', ie: '',
    street: '', number: '', complement: '', district: '', city: '', cityCode: '', state: '', postalCode: '',
    credit_authorized: false, credit_limit: 0,
  });

  useEffect(() => { if (currentAccount) loadCustomers(); }, [currentAccount]);

  const loadCustomers = async () => {
    if (!currentAccount) return;
    setLoading(true);
    const allRows: Customer[] = [];
    const batchSize = 1000;
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from('customers').select('*').eq('account_id', currentAccount.id).order('name').range(from, from + batchSize - 1);
      if (data && data.length > 0) { allRows.push(...(data as Customer[])); from += batchSize; hasMore = data.length === batchSize; } else { hasMore = false; }
    }
    setCustomers(allRows);
    setLoading(false);
  };

  const formatDocument = (v: string) => {
    const n = v.replace(/\D/g, '');
    if (n.length <= 11) return n.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
    return n.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18);
  };

  const formatCep = (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);

  const handleDocumentBlur = async () => {
    if (editingCustomer) return;
    const doc = formData.document.replace(/\D/g, '');
    if (!currentAccount) return;

    // Validate CPF/CNPJ digit verifier
    if (doc.length > 0) {
      const v = validateDocument(doc);
      setDocError(v.valid ? null : v.message || 'Documento inválido');
      if (!v.valid) return; // do not auto-lookup if invalid
    } else {
      setDocError(null);
    }

    // Check existing customer first
    if (doc.length === 11 || doc.length === 14) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('account_id', currentAccount.id)
        .eq('document', doc)
        .maybeSingle();

      if (existingCustomer) {
        const addr = existingCustomer.address_json as AddressJson | null;
        setFormData({
          name: existingCustomer.name,
          document: existingCustomer.document ? formatDocument(existingCustomer.document) : '',
          email: existingCustomer.email || '',
          phone: existingCustomer.phone || '',
          birth_date: (existingCustomer as any).birth_date || '',
          ie: addr?.ie || '',
          street: addr?.street || '',
          number: addr?.number || '',
          complement: addr?.complement || '',
          district: addr?.district || '',
          city: addr?.city || '',
          cityCode: addr?.cityCode || '',
          state: addr?.state || '',
          postalCode: addr?.postalCode ? formatCep(addr.postalCode) : '',
          credit_authorized: existingCustomer.credit_authorized || false,
          credit_limit: existingCustomer.credit_limit || 0,
        });
        setEditingCustomer(existingCustomer as Customer);
        toast({ title: 'Cliente encontrado!', description: 'Dados preenchidos automaticamente.' });
        return;
      }
    }

    // If CNPJ (14 digits), fetch from BrasilAPI
    if (doc.length === 14) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`);
        if (res.ok) {
          const data = await res.json();
          setFormData(prev => ({
            ...prev,
            name: data.razao_social || prev.name,
            email: data.email || prev.email,
            phone: data.ddd_telefone_1 || prev.phone,
            street: data.logradouro || prev.street,
            number: data.numero || prev.number,
            complement: data.complemento || prev.complement,
            district: data.bairro || prev.district,
            city: data.municipio || prev.city,
            cityCode: data.codigo_municipio?.toString() || prev.cityCode,
            state: data.uf || prev.state,
            postalCode: data.cep ? formatCep(data.cep) : prev.postalCode,
          }));
          toast({ title: 'CNPJ encontrado!', description: 'Dados preenchidos automaticamente.' });
        }
      } catch {
        // Silently fail
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleCepBlur = async () => {
    const cep = formData.postalCode.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setLoadingCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!d.erro) setFormData(p => ({ ...p, street: d.logradouro || p.street, district: d.bairro || p.district, city: d.localidade || p.city, cityCode: d.ibge || p.cityCode, state: d.uf || p.state }));
    } catch {} finally { setLoadingCep(false); }
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setDocError(null);
    setFormData({ name: '', document: '', email: '', phone: '', birth_date: '', ie: '', street: '', number: '', complement: '', district: '', city: '', cityCode: '', state: '', postalCode: '', credit_authorized: false, credit_limit: 0 });
    setShowModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    const addr = c.address_json as AddressJson | null;
    setFormData({
      name: c.name, document: c.document ? formatDocument(c.document) : '', email: c.email || '', phone: c.phone || '',
      birth_date: (c as any).birth_date || '',
      ie: addr?.ie || '',
      street: addr?.street || '', number: addr?.number || '', complement: addr?.complement || '', district: addr?.district || '',
      city: addr?.city || '', cityCode: addr?.cityCode || '', state: addr?.state || '', postalCode: addr?.postalCode ? formatCep(addr.postalCode) : '',
      credit_authorized: c.credit_authorized || false, credit_limit: c.credit_limit || 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast({ variant: 'destructive', title: 'Nome é obrigatório' }); return; }
    if (!currentAccount) return;

    // CPF/CNPJ validation: block save if invalid
    const documentNumbers = formData.document.replace(/\D/g, '');
    if (documentNumbers.length > 0) {
      const v = validateDocument(documentNumbers);
      if (!v.valid) {
        setDocError(v.message || 'Documento inválido');
        toast({ variant: 'destructive', title: 'CPF/CNPJ inválido', description: v.message });
        return;
      }
    }

    setSaving(true);
    const postalCodeNumbers = formData.postalCode.replace(/\D/g, '');
    let addressJson: AddressJson | null = null;
    const ieClean = (formData.ie || '').trim().toUpperCase();
    if (formData.street || formData.city || formData.state || postalCodeNumbers || ieClean) {
      addressJson = { street: formData.street || undefined, number: formData.number || undefined, complement: formData.complement || undefined, district: formData.district || undefined, city: formData.city || undefined, cityCode: formData.cityCode || undefined, state: formData.state || undefined, postalCode: postalCodeNumbers || undefined, ie: ieClean || undefined };
    }
    try {
      const payload = {
        name: formData.name.trim(), document: documentNumbers || null, email: formData.email || null,
        phone: formData.phone || null, address_json: addressJson,
        birth_date: formData.birth_date || null,
        credit_authorized: formData.credit_authorized, credit_limit: formData.credit_limit,
      };
      if (editingCustomer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingCustomer.id);
        if (error) throw error;
        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'customer', entityId: editingCustomer.id, details: { nome: payload.name } });
        toast({ title: 'Cliente atualizado!' });
      } else {
        const { error } = await supabase.from('customers').insert({ ...payload, account_id: currentAccount.id });
        if (error) throw error;
        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'customer', details: { nome: payload.name } });
        toast({ title: 'Cliente criado!' });
      }
      setShowModal(false); loadCustomers();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Erro', description: e.message }); }
    finally { setSaving(false); }
  };

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const isNumeric = /^\d+$/.test(qDigits) && qDigits.length >= 3;
    // Name: match by START of any word (e.g., "ana" matches "Ana Silva", "Maria Ana", but NOT "Mariana")
    const nameWords = c.name.toLowerCase().split(/\s+/).filter(Boolean);
    const nameMatch = nameWords.some(w => w.startsWith(q));
    const docMatch = isNumeric && (c.document || '').replace(/\D/g, '').includes(qDigits);
    const emailMatch = c.email?.toLowerCase().startsWith(q) || false;
    return nameMatch || docMatch || emailMatch;
  });
  // Reset page on search
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCustomers = filteredCustomers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">Cadastro e crediário</p>
        </div>
        {canManageCustomers && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" asChild><Link to="/app/customers/import"><Upload className="mr-1 h-4 w-4" /> CSV</Link></Button>
            <Button size="sm" onClick={openCreateModal}><Plus className="mr-1 h-4 w-4" /> Novo</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 p-3 sm:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          {loading ? <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          : filteredCustomers.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">Nenhum cliente</div>
          : (
            <>
            <div className="space-y-2">
              {paginatedCustomers.map(c => (
                <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      {c.credit_authorized && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Crediário ✓</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.document ? formatDocument(c.document) : ''}{c.phone ? ` • ${c.phone}` : ''}
                      {c.credit_authorized ? ` • Limite: ${fc(c.credit_limit)}` : ''}
                    </p>
                  </div>
                  {canManageCustomers && <Button variant="ghost" size="sm" onClick={() => openEditModal(c)}><Pencil className="h-4 w-4" /></Button>}
                </div>
              ))}
            </div>
            <SmartPagination currentPage={safePage} totalPages={totalPages} totalItems={filteredCustomers.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            <DialogDescription>Dados do cliente e configuração de crediário</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Dados Básicos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nome *</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ</Label>
                  <Input
                    value={formData.document}
                    onChange={e => { setFormData({ ...formData, document: formatDocument(e.target.value) }); if (docError) setDocError(null); }}
                    onBlur={handleDocumentBlur}
                    maxLength={18}
                    placeholder="Busca automática"
                    className={docError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {docError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {docError}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={formData.ie}
                    onChange={e => setFormData({ ...formData, ie: e.target.value })}
                    placeholder='Apenas números ou "ISENTO"'
                  />
                  <p className="text-[11px] text-muted-foreground">Obrigatório para emissão de NF-e a clientes PJ. Use "ISENTO" se não houver IE.</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Data de Nascimento
                    {isModuleDisabled(currentAccount, 'email_marketing') && <span title={MODULE_BLOCKED_MESSAGE}>🔒</span>}
                  </Label>
                  <Input
                    type="date"
                    value={formData.birth_date}
                    onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                    disabled={isModuleDisabled(currentAccount, 'email_marketing')}
                    title={isModuleDisabled(currentAccount, 'email_marketing') ? MODULE_BLOCKED_MESSAGE : undefined}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {isModuleDisabled(currentAccount, 'email_marketing')
                      ? 'Recurso de aniversário bloqueado para esta conta.'
                      : 'Usada para envio automático de mensagem de aniversário 🎂'}
                  </p>
                </div>
              </div>
            </div>

            {/* Crediário - only admin can edit */}
            {isOwnerOrAdmin && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Crediário</h3>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Switch checked={formData.credit_authorized} onCheckedChange={v => setFormData({ ...formData, credit_authorized: v })} />
                  <div>
                    <p className="text-sm font-medium">Crediário autorizado</p>
                    <p className="text-xs text-muted-foreground">Permite venda a prazo no PDV</p>
                  </div>
                </div>
                {formData.credit_authorized && (
                  <div className="space-y-2">
                    <Label>Limite de Crédito (R$)</Label>
                    <Input type="number" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: Number(e.target.value) })} min={0} step={100} />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Endereço (NF-e)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input value={formData.postalCode} onChange={e => setFormData({ ...formData, postalCode: formatCep(e.target.value) })} onBlur={handleCepBlur} maxLength={9} />
                    {loadingCep && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />}
                  </div>
                </div>
                <div className="col-span-2 space-y-2"><Label>Logradouro</Label><Input value={formData.street} onChange={e => setFormData({ ...formData, street: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2"><Label>Número</Label><Input value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} /></div>
                <div className="space-y-2"><Label>Complemento</Label><Input value={formData.complement} onChange={e => setFormData({ ...formData, complement: e.target.value })} /></div>
                <div className="col-span-2 space-y-2"><Label>Bairro</Label><Input value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Cidade</Label><Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} /></div>
                <div className="space-y-2"><Label>Cód. IBGE</Label><Input value={formData.cityCode} onChange={e => setFormData({ ...formData, cityCode: e.target.value })} /></div>
                <div className="space-y-2"><Label>UF</Label>
                  <Select value={formData.state} onValueChange={v => setFormData({ ...formData, state: v })}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{BRAZIL_STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
