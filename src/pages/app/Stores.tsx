import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Store, Edit2, Search, ImagePlus, Palette, Copy } from 'lucide-react';
import type { Store as StoreType } from '@/types/database';
import { getStoreLogoUrl, uploadStoreLogo } from '@/utils/storeLogo';
import { MENU_THEME_OPTIONS, type MenuTheme } from '@/utils/menuIcons';

const PIX_KEY_TYPES = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'random', label: 'Chave aleatória' },
];

const UF_OPTIONS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function Stores() {
  const { user, currentAccount, isOwnerOrAdmin, setCurrentAccount } = useAuth();
  const { toast } = useToast();

  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuTheme, setMenuTheme] = useState<MenuTheme>(((currentAccount as any)?.menu_theme as MenuTheme) || 'party');
  const [savingTheme, setSavingTheme] = useState(false);

  const [editingStore, setEditingStore] = useState<StoreType | null>(null);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ie, setIe] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('');
  const [phone, setPhone] = useState('');
  // Address fields
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [fetchingCep, setFetchingCep] = useState(false);
  const [fetchingCnpj, setFetchingCnpj] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [autoPrintFiscal, setAutoPrintFiscal] = useState(false);
  const [receiptFormat, setReceiptFormat] = useState('thermal');
  useEffect(() => { if (currentAccount) loadStores(); }, [currentAccount]);
  useEffect(() => {
    setMenuTheme(((currentAccount as any)?.menu_theme as MenuTheme) || 'party');
  }, [currentAccount]);

  const saveMenuTheme = async (theme: MenuTheme) => {
    if (!currentAccount) return;
    setSavingTheme(true);
    try {
      const { error } = await supabase.from('accounts').update({ menu_theme: theme } as any).eq('id', currentAccount.id);
      if (error) throw error;
      setMenuTheme(theme);
      // Update in-memory currentAccount so the sidebar re-renders immediately
      setCurrentAccount({ ...(currentAccount as any), menu_theme: theme });
      toast({ title: 'Tema do menu atualizado', description: 'Os ícones da barra lateral foram trocados.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar tema', description: error.message });
    } finally {
      setSavingTheme(false);
    }
  };

  const loadStores = async () => {
    if (!currentAccount) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('stores').select('*').eq('account_id', currentAccount.id).order('name');
      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setLoading(false); }
  };

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18);
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
  };

  const lookupCep = useCallback(async (cepValue: string) => {
    const cepNumbers = cepValue.replace(/\D/g, '');
    if (cepNumbers.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepNumbers}/json/`);
      const data = await res.json();
      if (data.erro) { toast({ variant: 'destructive', title: 'CEP não encontrado' }); return; }
      setStreet(data.logradouro || '');
      setDistrict(data.bairro || '');
      setCity(data.localidade || '');
      setState(data.uf || '');
      toast({ title: 'Endereço preenchido pelo CEP' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao consultar CEP' });
    } finally { setFetchingCep(false); }
  }, [toast]);

  const lookupCnpj = useCallback(async (cnpjValue: string) => {
    const cnpjNumbers = cnpjValue.replace(/\D/g, '');
    if (cnpjNumbers.length !== 14) return;
    setFetchingCnpj(true);
    try {
      const res = await fetch(`https://open.cnpja.com/office/${cnpjNumbers}`);
      if (!res.ok) throw new Error('Falha na consulta');
      const data = await res.json();
      if (data.company?.name) setName(prev => prev || data.alias || data.company.name);
      if (data.registrations?.[0]?.number) setIe(prev => prev || data.registrations[0].number);
      const addr = data.address;
      if (addr) {
        setStreet(prev => prev || `${addr.street || ''} ${addr.details || ''}`.trim());
        setNumber(prev => prev || String(addr.number || ''));
        setDistrict(prev => prev || addr.district || '');
        setCity(prev => prev || addr.city || '');
        setState(prev => prev || addr.state || '');
        setPostalCode(prev => prev || formatCep(String(addr.zip || '')));
      }
      toast({ title: 'Dados preenchidos pelo CNPJ' });
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível consultar o CNPJ', description: 'Preencha os dados manualmente.' });
    } finally { setFetchingCnpj(false); }
  }, [toast]);

  const openDialog = (store?: StoreType) => {
    if (store) {
      setEditingStore(store);
      setName(store.name);
      setCnpj(formatCnpj(store.cnpj));
      setIe(store.ie || '');
      setPixKey(store.pix_key || '');
      setPixKeyType(store.pix_key_type || '');
      setPhone((store as any).phone || '');
      const addr = (store.address_json || {}) as any;
      setStreet(addr.street || '');
      setNumber(addr.number || '');
      setDistrict(addr.district || '');
      setCity(addr.city || '');
      setState(addr.state || '');
      setPostalCode(addr.postalCode ? formatCep(addr.postalCode) : '');
      setLogoFile(null);
      setLogoPreviewUrl(getStoreLogoUrl(store.logo_path, store.logo_updated_at));
      setAutoPrintReceipt((store as any).pdv_auto_print_receipt || false);
      setAutoPrintFiscal((store as any).pdv_auto_print_fiscal || false);
      setReceiptFormat((store as any).pdv_receipt_format || 'thermal');
    } else {
      setEditingStore(null);
      setName(''); setCnpj(''); setIe(''); setPixKey(''); setPixKeyType(''); setPhone('');
      setStreet(''); setNumber(''); setDistrict(''); setCity(''); setState(''); setPostalCode('');
      setLogoFile(null);
      setLogoPreviewUrl(null);
      setAutoPrintReceipt(false);
      setAutoPrintFiscal(false);
      setReceiptFormat('thermal');
    }
    setDialogOpen(true);
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Arquivo inválido', description: 'Envie uma imagem PNG, JPG ou WebP.' });
      return;
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!currentAccount || !name.trim() || !cnpj.trim()) {
      toast({ variant: 'destructive', title: 'Preencha nome e CNPJ' }); return;
    }
    const cnpjNumbers = cnpj.replace(/\D/g, '');
    if (cnpjNumbers.length !== 14) {
      toast({ variant: 'destructive', title: 'CNPJ inválido' }); return;
    }
    setSaving(true);
    try {
      const addressJson = (street.trim() || city.trim() || state.trim() || postalCode.trim()) ? {
        street: street.trim(),
        number: number.trim() || 'S/N',
        district: district.trim() || 'Centro',
        city: city.trim(),
        state: state.trim().toUpperCase(),
        postalCode: postalCode.replace(/\D/g, ''),
      } : null;
      const payload: any = {
        name: name.trim(), cnpj: cnpjNumbers, ie: ie.trim() || null,
        pix_key: pixKey.trim() || null, pix_key_type: pixKeyType || null,
        phone: phone.trim() || null,
        address_json: addressJson,
        pdv_auto_print_receipt: autoPrintReceipt,
        pdv_auto_print_fiscal: autoPrintFiscal,
        pdv_receipt_format: receiptFormat,
      };
      if (editingStore) {
        const { error } = await supabase.from('stores').update(payload).eq('id', editingStore.id);
        if (error) throw error;

        if (logoFile) {
          const logoPath = await uploadStoreLogo(editingStore.id, logoFile);
          const { error: logoError } = await supabase
            .from('stores')
            .update({ logo_path: logoPath, logo_updated_at: new Date().toISOString() })
            .eq('id', editingStore.id);
          if (logoError) throw logoError;
        }

        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'store', entityId: editingStore.id, details: { nome: name.trim() } });
        toast({ title: 'Loja atualizada' });
      } else {
        const { data: createdStore, error } = await supabase
          .from('stores')
          .insert({ ...payload, account_id: currentAccount.id })
          .select('*')
          .single();
        if (error) throw error;

        if (logoFile && createdStore) {
          const logoPath = await uploadStoreLogo(createdStore.id, logoFile);
          const { error: logoError } = await supabase
            .from('stores')
            .update({ logo_path: logoPath, logo_updated_at: new Date().toISOString() })
            .eq('id', createdStore.id);
          if (logoError) throw logoError;
        }

        await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'store', entityId: createdStore?.id, details: { nome: name.trim() } });
        toast({ title: 'Loja cadastrada' });
      }
      setDialogOpen(false); loadStores();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setSaving(false); }
  };

  const toggleStoreActive = async (store: StoreType) => {
    try {
      const { error } = await supabase.from('stores').update({ is_active: !store.is_active }).eq('id', store.id);
      if (error) throw error;
      loadStores();
      toast({ title: store.is_active ? 'Loja desativada' : 'Loja ativada' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isOwnerOrAdmin) return <div className="flex h-64 items-center justify-center"><p className="text-muted-foreground">Acesso restrito</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Lojas</h1>
          <p className="text-sm text-muted-foreground">Gerencie lojas, CNPJ e PIX</p>
        </div>
        <Button size="sm" onClick={() => openDialog()}><Plus className="mr-1 h-4 w-4" /> Nova Loja</Button>
      </div>

      {/* Tema do menu lateral */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Tema do Menu Lateral
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Escolha o conjunto de ícones do menu de acordo com o segmento da sua loja. A troca é imediata para todos os usuários da conta.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {MENU_THEME_OPTIONS.map(opt => {
              const selected = menuTheme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={savingTheme}
                  onClick={() => saveMenuTheme(opt.value)}
                  className={`text-left rounded-xl border-2 p-4 transition-all ${
                    selected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30'
                  } ${savingTheme ? 'opacity-60 cursor-wait' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{opt.label}</span>
                    {selected && <Badge className="text-[10px]">Em uso</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Total</CardTitle><Store className="h-3 w-3 text-muted-foreground" /></CardHeader><CardContent className="p-3 pt-0"><div className="text-xl font-bold">{stores.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Ativas</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-xl font-bold">{stores.filter(s => s.is_active).length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Com PIX</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-xl font-bold">{stores.filter(s => s.pix_key).length}</div></CardContent></Card>
      </div>

      <div className="space-y-2">
        {stores.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma loja cadastrada</CardContent></Card>
        ) : stores.map(store => (
          <div key={store.id} className="flex items-center justify-between border rounded-lg p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{store.name}</p>
                <Badge variant={store.is_active ? 'default' : 'secondary'} className="text-xs">{store.is_active ? 'Ativa' : 'Inativa'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                CNPJ: {formatCnpj(store.cnpj)}{store.ie ? ` • IE: ${store.ie}` : ''}
                {store.pix_key ? ` • PIX: ${store.pix_key.substring(0, 20)}...` : ''}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] text-muted-foreground font-mono select-all break-all">ID: {store.id}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => {
                    navigator.clipboard.writeText(store.id);
                    toast({ title: 'ID copiado', description: store.id });
                  }}
                  title="Copiar ID da loja"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Switch checked={store.is_active} onCheckedChange={() => toggleStoreActive(store)} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(store)}><Edit2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingStore ? 'Editar Loja' : 'Nova Loja'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Razão Social *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da empresa" /></div>
            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <div className="flex gap-2">
                <Input value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} className="flex-1" />
                <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={fetchingCnpj || cnpj.replace(/\D/g, '').length !== 14} onClick={() => lookupCnpj(cnpj)}>
                  {fetchingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2"><Label>Inscrição Estadual</Label><Input value={ie} onChange={e => setIe(e.target.value)} placeholder="Opcional" /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(31) 99999-9999" /></div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Endereço (obrigatório para NF-e)</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-2"><Label>Logradouro</Label><Input value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua das Flores" /></div>
                <div className="space-y-2"><Label>Número</Label><Input value={number} onChange={e => setNumber(e.target.value)} placeholder="123" /></div>
              </div>
              <div className="space-y-2"><Label>Bairro</Label><Input value={district} onChange={e => setDistrict(e.target.value)} placeholder="Centro" /></div>
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2 space-y-2"><Label>Cidade</Label><Input value={city} onChange={e => setCity(e.target.value)} placeholder="Belo Horizonte" /></div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Select value={state || '__none__'} onValueChange={v => setState(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">--</SelectItem>
                      {UF_OPTIONS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>CEP</Label>
                  <div className="flex gap-2">
                    <Input value={postalCode} onChange={e => setPostalCode(formatCep(e.target.value))} placeholder="00000-000" maxLength={9} className="flex-1" />
                    <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={fetchingCep || postalCode.replace(/\D/g, '').length !== 8} onClick={() => lookupCep(postalCode)}>
                      {fetchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Logomarca da empresa</h3>
              <div className="rounded-2xl border border-dashed border-border bg-gradient-to-br from-muted/30 to-muted/60 p-5">
                <div className="flex flex-col gap-4">
                  <div className="relative flex min-h-[80px] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-border/50 bg-background p-4 shadow-inner">
                    {logoPreviewUrl ? (
                      <img src={logoPreviewUrl} alt="Pré-visualização da logomarca da loja" className="max-h-24 max-w-full object-contain" loading="lazy" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center text-muted-foreground py-4">
                        <div className="rounded-full bg-muted p-3">
                          <ImagePlus className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-medium">Nenhuma logomarca enviada</span>
                        <span className="text-[10px]">PNG, JPG, SVG ou WebP — qualquer proporção</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="store-logo" className="text-sm font-semibold">Enviar logomarca</Label>
                    <Input id="store-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoChange} className="file:bg-primary file:text-primary-foreground file:rounded-lg file:border-0 file:px-3 file:py-1 file:text-xs file:font-medium file:cursor-pointer" />
                    <p className="text-xs text-muted-foreground">
                      Aceita qualquer proporção — retangular, quadrada ou horizontal. Será usada nos PDFs, e-commerce e comprovantes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Configuração PIX</h3>
              <div className="space-y-2">
                <Label>Tipo de Chave</Label>
                <Select value={pixKeyType || '__none__'} onValueChange={v => setPixKeyType(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {PIX_KEY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Chave PIX para copia e cola" />
                <p className="text-xs text-muted-foreground">Esta chave será exibida no PDV quando a forma de pagamento for PIX.</p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">🖨️ Impressão PDV</h3>
              <div className="space-y-2">
                <Label>Formato do comprovante</Label>
                <Select value={receiptFormat} onValueChange={setReceiptFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thermal">Cupom Térmico (80mm)</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Imprimir comprovante automaticamente</p>
                  <p className="text-xs text-muted-foreground">Imprime o cupom do pedido ao finalizar a venda</p>
                </div>
                <Switch checked={autoPrintReceipt} onCheckedChange={setAutoPrintReceipt} />
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Imprimir cupom fiscal automaticamente</p>
                  <p className="text-xs text-muted-foreground">Imprime o cupom fiscal (NFC-e) ao finalizar a venda</p>
                </div>
                <Switch checked={autoPrintFiscal} onCheckedChange={setAutoPrintFiscal} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}