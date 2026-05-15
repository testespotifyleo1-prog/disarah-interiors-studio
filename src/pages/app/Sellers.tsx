import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Users, Percent, Store, UserPlus, TrendingUp, DollarSign, ShoppingCart, CheckCircle, Calendar, KeyRound, Pencil, Mail } from 'lucide-react';
import type { MembershipWithProfile, SellerCommissionRule, Store as StoreType, StoreMembership, CommissionCycle } from '@/types/database';

interface SellerWithDetails extends MembershipWithProfile {
  commission_rule?: SellerCommissionRule;
  store_memberships?: (StoreMembership & { stores?: StoreType })[];
  email?: string;
}

interface SellerMetrics {
  user_id: string;
  totalSales: number;
  totalRevenue: number;
  avgTicket: number;
  pendingCommission: number;
  paidCommission: number;
}

export default function Sellers() {
  const { user, currentAccount, isOwnerOrAdmin, stores, userRole } = useAuth();
  const { toast } = useToast();

  const [sellers, setSellers] = useState<SellerWithDetails[]>([]);
  const [metrics, setMetrics] = useState<Record<string, SellerMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('lista');

  const [selectedSeller, setSelectedSeller] = useState<SellerWithDetails | null>(null);
  const [commissionPercent, setCommissionPercent] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteStoreId, setInviteStoreId] = useState('');
  const [inviteRole, setInviteRole] = useState<'seller' | 'manager'>('seller');

  const [assignStoreId, setAssignStoreId] = useState('');

  // Commission cycles
  const [cycles, setCycles] = useState<Record<string, CommissionCycle[]>>({});
  const [payConfirmSeller, setPayConfirmSeller] = useState<SellerWithDetails | null>(null);
  const [cycleCommissionTotal, setCycleCommissionTotal] = useState(0);

  // Password reset
  const [resetPwdSeller, setResetPwdSeller] = useState<SellerWithDetails | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);

  // Edit seller
  const [editSeller, setEditSeller] = useState<SellerWithDetails | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', role: 'seller' as 'seller' | 'manager' });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { if (currentAccount) loadSellers(); }, [currentAccount]);

  const loadSellers = async () => {
    if (!currentAccount) return;
    setLoading(true);
    try {
      const { data: memberships, error: membershipsError } = await supabase
        .from('memberships').select('*').eq('account_id', currentAccount.id).in('role', ['seller', 'manager']);
      if (membershipsError) throw membershipsError;

      const sellerUserIds = memberships?.map((m: any) => m.user_id) || [];

      let profiles: any[] = [];
      if (sellerUserIds.length > 0) {
        const { data } = await supabase.from('profiles').select('*').in('user_id', sellerUserIds);
        profiles = data || [];
      }

      const { data: rules } = await supabase.from('seller_commission_rules').select('*').eq('account_id', currentAccount.id);

      let storeMemberships: any[] = [];
      if (sellerUserIds.length > 0) {
        const { data } = await supabase.from('store_memberships').select('*, stores(id, name)').in('user_id', sellerUserIds).eq('is_active', true);
        storeMemberships = data || [];
      }

      let sellersWithDetails = (memberships || []).map((m: any) => ({
        ...m,
        profiles: profiles.find((p: any) => p.user_id === m.user_id) || null,
        commission_rule: rules?.find((r: any) => r.seller_user_id === m.user_id),
        store_memberships: storeMemberships.filter((sm: any) => sm.user_id === m.user_id),
      }));

      // Manager only sees sellers assigned to the same store(s) as the manager
      if (userRole === 'manager') {
        const myStoreIds = new Set(stores.map(s => s.id));
        sellersWithDetails = sellersWithDetails.filter((s: any) =>
          s.user_id === user?.id || // always include self
          (s.store_memberships || []).some((sm: any) => myStoreIds.has(sm.store_id))
        );
      }

      // Fetch emails via edge function (auth.users not directly readable)
      const visibleIdsForEmails = sellersWithDetails.map((s: any) => s.user_id);
      if (isOwnerOrAdmin && visibleIdsForEmails.length > 0) {
        try {
          const { data: emailsRes } = await supabase.functions.invoke('update-seller', {
            body: { action: 'list_emails', account_id: currentAccount.id, user_ids: visibleIdsForEmails },
          });
          const emailMap: Record<string, string> = emailsRes?.emails || {};
          sellersWithDetails = sellersWithDetails.map((s: any) => ({ ...s, email: emailMap[s.user_id] || '' }));
        } catch (e) {
          console.warn('Failed to load emails', e);
        }
      }

      setSellers(sellersWithDetails);

      // Load performance metrics (only for visible sellers)
      const visibleIds = sellersWithDetails.map((s: any) => s.user_id);
      if (visibleIds.length > 0) {
        const { data: sales } = await supabase.from('sales').select('id, total, seller_user_id')
          .eq('account_id', currentAccount.id).eq('status', 'paid').in('seller_user_id', visibleIds);

        const { data: commissions } = await supabase.from('commissions').select('seller_user_id, value, status')
          .in('seller_user_id', visibleIds);

        const metricsMap: Record<string, SellerMetrics> = {};
        visibleIds.forEach(uid => {
          const sellerSales = (sales || []).filter(s => s.seller_user_id === uid);
          const sellerCommissions = (commissions || []).filter(c => c.seller_user_id === uid);
          metricsMap[uid] = {
            user_id: uid,
            totalSales: sellerSales.length,
            totalRevenue: sellerSales.reduce((s, sale) => s + Number(sale.total), 0),
            avgTicket: sellerSales.length > 0 ? sellerSales.reduce((s, sale) => s + Number(sale.total), 0) / sellerSales.length : 0,
            pendingCommission: sellerCommissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.value || 0), 0),
            paidCommission: sellerCommissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.value || 0), 0),
          };
        });
        setMetrics(metricsMap);

        // Load commission cycles
        const { data: cyclesData } = await supabase.from('commission_cycles').select('*')
          .eq('account_id', currentAccount.id).in('seller_user_id', visibleIds)
          .order('created_at', { ascending: false });
        const cyclesMap: Record<string, CommissionCycle[]> = {};
        (cyclesData || []).forEach((c: any) => {
          if (!cyclesMap[c.seller_user_id]) cyclesMap[c.seller_user_id] = [];
          cyclesMap[c.seller_user_id].push(c);
        });
        setCycles(cyclesMap);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setLoading(false); }
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fd = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  const openCommissionDialog = (seller: SellerWithDetails) => {
    setSelectedSeller(seller);
    setCommissionPercent(seller.commission_rule?.percent_default?.toString() || '');
    setDialogOpen(true);
  };

  const openStoreDialog = (seller: SellerWithDetails) => {
    setSelectedSeller(seller);
    setAssignStoreId('');
    setStoreDialogOpen(true);
  };

  const handleSaveCommission = async () => {
    if (!selectedSeller || !currentAccount) return;
    const percent = parseFloat(commissionPercent) || 0;
    if (percent < 0 || percent > 100) { toast({ variant: 'destructive', title: 'Porcentagem inválida' }); return; }
    setSaving(true);
    try {
      const existingRule = sellers.find(s => s.user_id === selectedSeller.user_id)?.commission_rule;
      if (existingRule) {
        await supabase.from('seller_commission_rules').update({ percent_default: percent }).eq('id', existingRule.id);
      } else {
        await supabase.from('seller_commission_rules').insert({ account_id: currentAccount.id, seller_user_id: selectedSeller.user_id, percent_default: percent });
      }
      await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'commission', details: { vendedor: selectedSeller.profiles?.full_name, percentual: percent } });
      toast({ title: `Comissão: ${percent}%` });
      setDialogOpen(false); loadSellers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setSaving(false); }
  };

  const handleInviteSeller = async () => {
    if (!currentAccount || !inviteEmail.trim() || !inviteFullName.trim() || !invitePassword.trim()) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos' }); return;
    }
    if (invitePassword.length < 6) { toast({ variant: 'destructive', title: 'Senha deve ter 6+ caracteres' }); return; }
    setSaving(true);
    try {
      const response = await supabase.functions.invoke('create-seller', {
        body: { email: inviteEmail.trim(), password: invitePassword, full_name: inviteFullName.trim(), account_id: currentAccount.id, store_id: inviteStoreId || null, role: inviteRole },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'create', entityType: inviteRole, details: { nome: inviteFullName.trim(), email: inviteEmail.trim(), role: inviteRole } });
      toast({ title: `${inviteRole === 'manager' ? 'Gerente' : 'Vendedor'} cadastrado!`, description: `Login: ${inviteEmail.trim()}` });
      setInviteDialogOpen(false); setInviteEmail(''); setInviteFullName(''); setInvitePassword(''); setInviteStoreId(''); setInviteRole('seller');
      loadSellers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setSaving(false); }
  };

  const handleAssignStore = async () => {
    if (!selectedSeller || !assignStoreId) return;
    const existing = selectedSeller.store_memberships?.find(sm => sm.store_id === assignStoreId);
    if (existing) { toast({ variant: 'destructive', title: 'Já vinculado' }); return; }
    setSaving(true);
    try {
      const role_in_store = selectedSeller.role === 'manager' ? 'manager' : 'seller';
      await supabase.from('store_memberships').insert({ store_id: assignStoreId, user_id: selectedSeller.user_id, role_in_store, is_active: true });
      toast({ title: 'Vinculado!' }); setStoreDialogOpen(false); loadSellers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setSaving(false); }
  };

  const removeStoreAssignment = async (id: string) => {
    await supabase.from('store_memberships').delete().eq('id', id);
    toast({ title: 'Desvinculado' }); loadSellers();
  };

  const toggleSellerActive = async (seller: MembershipWithProfile) => {
    await supabase.from('memberships').update({ is_active: !seller.is_active }).eq('id', seller.id);
    loadSellers();
    toast({ title: seller.is_active ? 'Desativado' : 'Ativado' });
  };

  // Commission cycle: mark as paid
  const openPayConfirm = async (seller: SellerWithDetails) => {
    setPayConfirmSeller(seller);
    // Calculate pending commission for this seller
    const m = metrics[seller.user_id];
    setCycleCommissionTotal(m?.pendingCommission || 0);
  };

  const handleMarkCommissionPaid = async () => {
    if (!payConfirmSeller || !currentAccount) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const sellerId = payConfirmSeller.user_id;

      // Find open cycle or create closing entry
      const sellerCycles = cycles[sellerId] || [];
      const openCycle = sellerCycles.find(c => c.status === 'open');

      if (openCycle) {
        // Close the open cycle
        await supabase.from('commission_cycles').update({
          ended_at: now,
          total_commission: cycleCommissionTotal,
          status: 'paid',
          paid_at: now,
          paid_by: (await supabase.auth.getUser()).data.user?.id,
        }).eq('id', openCycle.id);
      } else {
        // Create a closed cycle retroactively
        await supabase.from('commission_cycles').insert({
          account_id: currentAccount.id,
          seller_user_id: sellerId,
          started_at: payConfirmSeller.created_at,
          ended_at: now,
          total_commission: cycleCommissionTotal,
          status: 'paid',
          paid_at: now,
          paid_by: (await supabase.auth.getUser()).data.user?.id,
        });
      }

      // Create new open cycle
      await supabase.from('commission_cycles').insert({
        account_id: currentAccount.id,
        seller_user_id: sellerId,
        started_at: now,
        status: 'open',
      });

      // Mark all pending commissions as paid
      const { data: pendingCommissions } = await supabase.from('commissions')
        .select('id').eq('seller_user_id', sellerId).eq('status', 'pending');
      if (pendingCommissions && pendingCommissions.length > 0) {
        const ids = pendingCommissions.map(c => c.id);
        await supabase.from('commissions').update({ status: 'paid' }).in('id', ids);
      }

      await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'pay', entityType: 'commission', details: { vendedor: payConfirmSeller.profiles?.full_name, valor: cycleCommissionTotal } });
      toast({ title: 'Comissão marcada como paga!', description: `${fc(cycleCommissionTotal)} - novo ciclo iniciado.` });
      setPayConfirmSeller(null);
      loadSellers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!resetPwdSeller || !currentAccount || !newPassword.trim()) return;
    setResettingPwd(true);
    try {
      const response = await supabase.functions.invoke('reset-seller-password', {
        body: { seller_user_id: resetPwdSeller.user_id, new_password: newPassword.trim(), account_id: currentAccount.id },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast({ title: 'Senha alterada!', description: `Senha de ${resetPwdSeller.profiles?.full_name} foi redefinida.` });
      setResetPwdSeller(null);
      setNewPassword('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setResettingPwd(false); }
  };

  const openEditDialog = (seller: SellerWithDetails) => {
    setEditSeller(seller);
    setEditForm({
      full_name: seller.profiles?.full_name || '',
      email: seller.email || '',
      role: (seller.role === 'manager' ? 'manager' : 'seller'),
    });
  };

  const handleSaveEdit = async () => {
    if (!editSeller || !currentAccount) return;
    if (!editForm.full_name.trim() || !editForm.email.trim()) {
      toast({ variant: 'destructive', title: 'Preencha nome e email' }); return;
    }
    setSavingEdit(true);
    try {
      const response = await supabase.functions.invoke('update-seller', {
        body: {
          action: 'update',
          account_id: currentAccount.id,
          seller_user_id: editSeller.user_id,
          full_name: editForm.full_name.trim(),
          email: editForm.email.trim(),
          role: editForm.role,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      await logActivity({ accountId: currentAccount.id, userId: user!.id, userName: user!.email, action: 'update', entityType: editForm.role, details: { nome: editForm.full_name, email: editForm.email, role: editForm.role } });
      toast({ title: 'Colaborador atualizado!' });
      setEditSeller(null);
      loadSellers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setSavingEdit(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Vendedores</h1>
          <p className="text-sm text-muted-foreground">Gestão, comissões e performance</p>
        </div>
        {isOwnerOrAdmin && <Button size="sm" onClick={() => setInviteDialogOpen(true)}><UserPlus className="mr-1 h-4 w-4" /> Novo</Button>}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Vendedores</CardTitle><Users className="h-3 w-3 text-muted-foreground" /></CardHeader><CardContent className="p-3 pt-0"><div className="text-xl font-bold">{sellers.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Ativos</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-xl font-bold">{sellers.filter(s => s.is_active).length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Com. Pendentes</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-yellow-600">{fc(Object.values(metrics).reduce((s, m) => s + m.pendingCommission, 0))}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-3"><CardTitle className="text-xs">Com. Pagas</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-green-600">{fc(Object.values(metrics).reduce((s, m) => s + m.paidCommission, 0))}</div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="lista" className="text-xs">Lista</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
          <TabsTrigger value="ciclos" className="text-xs">Ciclos de Comissão</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <div className="space-y-2">
            {sellers.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum vendedor</CardContent></Card>
            ) : sellers.map(seller => (
              <div key={seller.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{seller.profiles?.full_name || 'Sem nome'}</p>
                    {seller.role === 'manager' && (
                      <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/20">Gerente</Badge>
                    )}
                  </div>
                  {seller.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <Mail className="h-3 w-3 flex-shrink-0" /> {seller.email}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {seller.store_memberships && seller.store_memberships.length > 0 ?
                      seller.store_memberships.map((sm: any) => <Badge key={sm.id} variant="outline" className="text-xs">{sm.stores?.name}</Badge>)
                      : <span className="text-xs text-muted-foreground">Sem loja</span>}
                    {seller.role !== 'manager' && (
                      <Badge variant="secondary" className="text-xs">{seller.commission_rule?.percent_default?.toFixed(1) || '0.0'}%</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isOwnerOrAdmin && <Switch checked={seller.is_active} onCheckedChange={() => toggleSellerActive(seller)} />}
                  {isOwnerOrAdmin && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(seller)} title="Editar dados"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCommissionDialog(seller)} title="Comissão"><Percent className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openStoreDialog(seller)} title="Lojas"><Store className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setResetPwdSeller(seller); setNewPassword(''); }} title="Redefinir senha"><KeyRound className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <div className="space-y-3">
            {sellers.filter(s => s.is_active).map(seller => {
              const m = metrics[seller.user_id] || { totalSales: 0, totalRevenue: 0, avgTicket: 0, pendingCommission: 0, paidCommission: 0 };
              return (
                <Card key={seller.id}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-sm">{seller.profiles?.full_name || 'Sem nome'}</p>
                      {isOwnerOrAdmin && m.pendingCommission > 0 && (
                        <Button size="sm" variant="outline" onClick={() => openPayConfirm(seller)}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Pagar comissão
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="text-center rounded-lg bg-muted p-2">
                        <ShoppingCart className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                        <p className="text-lg font-bold">{m.totalSales}</p>
                        <p className="text-xs text-muted-foreground">Vendas</p>
                      </div>
                      <div className="text-center rounded-lg bg-muted p-2">
                        <TrendingUp className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                        <p className="text-sm font-bold">{fc(m.totalRevenue)}</p>
                        <p className="text-xs text-muted-foreground">Faturamento</p>
                      </div>
                      <div className="text-center rounded-lg bg-muted p-2">
                        <DollarSign className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                        <p className="text-sm font-bold">{fc(m.avgTicket)}</p>
                        <p className="text-xs text-muted-foreground">Ticket Médio</p>
                      </div>
                      <div className="text-center rounded-lg bg-yellow-500/10 p-2">
                        <p className="text-sm font-bold text-yellow-600">{fc(m.pendingCommission)}</p>
                        <p className="text-xs text-muted-foreground">Com. Pend.</p>
                      </div>
                      <div className="text-center rounded-lg bg-green-500/10 p-2">
                        <p className="text-sm font-bold text-green-600">{fc(m.paidCommission)}</p>
                        <p className="text-xs text-muted-foreground">Com. Paga</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="ciclos">
          <div className="space-y-3">
            {sellers.filter(s => s.is_active).map(seller => {
              const sellerCycles = cycles[seller.user_id] || [];
              const openCycle = sellerCycles.find(c => c.status === 'open');
              const paidCycles = sellerCycles.filter(c => c.status === 'paid');
              const m = metrics[seller.user_id] || { pendingCommission: 0 };
              return (
                <Card key={seller.id}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-sm">{seller.profiles?.full_name || 'Sem nome'}</p>
                      {isOwnerOrAdmin && m.pendingCommission > 0 && (
                        <Button size="sm" variant="outline" onClick={() => openPayConfirm(seller)}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Marcar como paga
                        </Button>
                      )}
                    </div>

                    {/* Current open cycle */}
                    <div className="rounded-lg border p-3 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">Ciclo Atual</Badge>
                        <Badge className="bg-green-500 text-white text-xs">Aberto</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Desde: {openCycle ? fd(openCycle.started_at) : 'Início'}
                      </p>
                      <p className="text-sm font-bold text-yellow-600 mt-1">Pendente: {fc(m.pendingCommission)}</p>
                    </div>

                    {/* Paid cycles */}
                    {paidCycles.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Ciclos Pagos:</p>
                        {paidCycles.slice(0, 5).map(c => (
                          <div key={c.id} className="flex items-center justify-between text-xs bg-muted rounded p-2">
                            <div>
                              <span>{fd(c.started_at)} → {c.ended_at ? fd(c.ended_at) : '...'}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-green-600">{fc(c.total_commission)}</span>
                              {c.paid_at && <p className="text-muted-foreground">Pago em {fd(c.paid_at)}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Commission Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Definir Comissão</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Vendedor: <strong>{selectedSeller?.profiles?.full_name}</strong></p>
            <div className="space-y-2">
              <Label>Porcentagem (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={commissionPercent} onChange={e => setCommissionPercent(e.target.value)} placeholder="5.0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCommission} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle><DialogDescription>Crie login e senha para vendedor ou gerente.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Perfil *</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as 'seller' | 'manager')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Vendedor (vê apenas as próprias vendas)</SelectItem>
                  <SelectItem value="manager">Gerente (vê todas vendas da loja + autoriza com PIN)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Nome *</Label><Input value={inviteFullName} onChange={e => setInviteFullName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Senha *</Label><Input type="password" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="Mín. 6 caracteres" /></div>
            <div className="space-y-2">
              <Label>Loja {inviteRole === 'manager' && <span className="text-xs text-muted-foreground">(o gerente verá apenas esta loja)</span>}</Label>
              <Select value={inviteStoreId || '__none__'} onValueChange={v => setInviteStoreId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={inviteRole === 'manager' ? 'Selecione a loja' : 'Opcional'} /></SelectTrigger>
                <SelectContent><SelectItem value="__none__">Nenhuma</SelectItem>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {inviteRole === 'manager' && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                💡 Após criar, o gerente poderá configurar o próprio PIN em <strong>Configurações → PIN</strong> para autorizar operações restritas no PDV.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleInviteSeller} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store Assignment */}
      <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lojas do Vendedor</DialogTitle><DialogDescription>{selectedSeller?.profiles?.full_name}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Vinculadas:</Label>
              {selectedSeller?.store_memberships && selectedSeller.store_memberships.length > 0 ? (
                <div className="space-y-2">
                  {selectedSeller.store_memberships.map((sm: any) => (
                    <div key={sm.id} className="flex items-center justify-between bg-muted p-2 rounded">
                      <span className="text-sm">{sm.stores?.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeStoreAssignment(sm.id)} className="text-destructive h-7 text-xs">Remover</Button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Nenhuma</p>}
            </div>
            <div className="border-t pt-4 space-y-2">
              <Label>Adicionar:</Label>
              <Select value={assignStoreId} onValueChange={setAssignStoreId}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {stores.filter(s => !selectedSeller?.store_memberships?.some((sm: any) => sm.store_id === s.id)).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStoreDialogOpen(false)}>Fechar</Button>
            <Button onClick={handleAssignStore} disabled={saving || !assignStoreId}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Commission Confirmation */}
      <AlertDialog open={!!payConfirmSeller} onOpenChange={(open) => !open && setPayConfirmSeller(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar comissão como paga</AlertDialogTitle>
            <AlertDialogDescription>
              Vendedor: <strong>{payConfirmSeller?.profiles?.full_name}</strong><br />
              Valor pendente: <strong>{fc(cycleCommissionTotal)}</strong><br /><br />
              Ao confirmar, o ciclo atual será fechado e um novo ciclo será iniciado automaticamente. As comissões pendentes serão marcadas como pagas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkCommissionPaid} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPwdSeller} onOpenChange={(v) => { if (!v) { setResetPwdSeller(null); setNewPassword(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Redefinir Senha</DialogTitle>
            <DialogDescription>
              Vendedor: <strong>{resetPwdSeller?.profiles?.full_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                onKeyDown={e => { if (e.key === 'Enter') handleResetPassword(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwdSeller(null)} size="sm">Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resettingPwd || newPassword.trim().length < 6} size="sm">
              {resettingPwd && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Seller Dialog */}
      <Dialog open={!!editSeller} onOpenChange={(v) => { if (!v) setEditSeller(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Editar colaborador</DialogTitle>
            <DialogDescription>Altere nome, email ou perfil de acesso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Perfil *</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v as 'seller' | 'manager' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Vendedor</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              <p className="text-xs text-muted-foreground">Alterar o email muda também o login do colaborador.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSeller(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
