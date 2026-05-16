import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, ShoppingCart, Package, Truck, Percent, Loader2,
  Wrench, CalendarDays, AlertTriangle, Clock, ArrowRight, ShieldAlert, Check, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MonthFilter, getMonthRange } from '@/components/MonthFilter';
import { isModuleEnabled } from '@/utils/accountModules';
import PartyStoreDashboard from '@/components/dashboard/PartyStoreDashboard';
import Last7DaysRevenueChart from '@/components/dashboard/Last7DaysRevenueChart';


interface DashboardStats {
  salesToday: number;
  revenueToday: number;
  netRevenueToday: number;
  salesMonth: number;
  revenueMonth: number;
  netRevenueMonth: number;
  pendingDeliveries: number;
  lowStockProducts: number;
  myCommissionsPending: number;
  myCommissionsPaid: number;
  pendingAssemblies: number;
  scheduledAssemblies: number;
  overdueReceivables: number;
  upcomingReceivables: number;
  pendingCreditRequests: number;
}

interface RecentSale {
  id: string;
  total: number;
  status: string;
  created_at: string;
  customers?: { name: string } | null;
}

interface AssemblyNotification {
  id: string;
  sale_id: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  assemblers?: { name: string } | null;
}

interface DeliveryNotification {
  id: string;
  sale_id: string;
  status: string;
  eta_at: string | null;
  drivers?: { name: string } | null;
}

interface CreditRequest {
  id: string;
  customer_id: string;
  sale_amount: number;
  excess_amount: number;
  current_limit: number;
  used_balance: number;
  requested_at: string;
  status: string;
  customers?: { name: string } | null;
}

const PARTY_STORE_ACCOUNTS = [
  '2480b8ae-c3a4-4a39-ad76-e6b41013f25e',
  '794d95b6-15e2-4ada-8aea-32998477f235',
];

export default function Dashboard() {
  const { currentAccount } = useAuth();

  if (currentAccount && PARTY_STORE_ACCOUNTS.includes(currentAccount.id)) {
    return <PartyStoreDashboard />;
  }

  return <DefaultDashboard />;
}

function DefaultDashboard() {
  const { user, currentAccount, currentStore, userRole, stores } = useAuth();
  const { toast } = useToast();
  const [profileName, setProfileName] = useState<string>('');

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.full_name) setProfileName(data.full_name); });
  }, [user?.id]);
  const [stats, setStats] = useState<DashboardStats>({
    salesToday: 0, revenueToday: 0, netRevenueToday: 0, salesMonth: 0, revenueMonth: 0, netRevenueMonth: 0,
    pendingDeliveries: 0, lowStockProducts: 0,
    myCommissionsPending: 0, myCommissionsPaid: 0,
    pendingAssemblies: 0, scheduledAssemblies: 0,
    overdueReceivables: 0, upcomingReceivables: 0,
    pendingCreditRequests: 0,
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [assemblyNotifications, setAssemblyNotifications] = useState<AssemblyNotification[]>([]);
  const [deliveryNotifications, setDeliveryNotifications] = useState<DeliveryNotification[]>([]);
  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(new Date());

  const isSeller = userRole === 'seller';
  const isAdmin = !isSeller;
  const isOwner = userRole === 'owner';
  const showAssemblies = isModuleEnabled(currentAccount, 'assemblies');
  const showCrediario = isModuleEnabled(currentAccount, 'crediario');
  const showDeliveries = true;

  useEffect(() => {
    if (currentAccount && currentStore) loadDashboardData();
  }, [currentAccount, currentStore, user, month]);

  const loadDashboardData = async () => {
    if (!currentAccount || !currentStore || !user) return;
    setLoading(true);
    const { startISO, endISO } = getMonthRange(month);
    const today = new Date().toISOString().split('T')[0];

    // Today range based on local timezone (00:00 to 23:59:59.999 local time)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const todayStartISO = startOfToday.toISOString();
    const todayEndISO = endOfToday.toISOString();

    try {
      // REGRA GLOBAL: vendas em crediário SEM ENTRADA não devem aparecer aqui.
      // Apenas o que efetivamente entrou no caixa conta — entradas no ato + parcelas
      // pagas pelo gerente/admin via baixa de crediário (que geram um payment).
      // Por isso usamos `payments.paid_value` (somando todos os métodos) como receita,
      // e filtramos os pagamentos do tipo "crediario" (são apenas marcação da venda
      // a prazo, não dinheiro recebido).
      const computeFromPayments = async (fromISO: string, toISO: string) => {
        let q = supabase
          .from('payments')
          .select('method, paid_value, card_fee_value, sale_id, sales!inner(store_id, seller_id, status)')
          .eq('sales.store_id', currentStore.id)
          .neq('sales.status', 'cancelled')
          .gte('created_at', fromISO).lte('created_at', toISO);
        if (isSeller) q = q.eq('sales.seller_id', user.id);
        const { data } = await q;
        let revenue = 0, fees = 0;
        const saleIds = new Set<string>();
        for (const p of (data || []) as any[]) {
          if (p.method === 'crediario') continue; // apenas marcação de venda a prazo
          revenue += Number(p.paid_value) || 0;
          fees += Number(p.card_fee_value) || 0;
          if (p.sale_id) saleIds.add(p.sale_id);
        }
        return { revenue, fees, count: saleIds.size };
      };

      const todayAgg = await computeFromPayments(todayStartISO, todayEndISO);
      const salesToday = todayAgg.count;
      const revenueToday = todayAgg.revenue;
      const netRevenueToday = revenueToday - todayAgg.fees;

      const monthAgg = await computeFromPayments(startISO, endISO);
      const salesMonth = monthAgg.count;
      const revenueMonth = monthAgg.revenue;
      const netRevenueMonth = revenueMonth - monthAgg.fees;

      let pendingDeliveries = 0, lowStockProducts = 0;
      let pendingAssemblies = 0, scheduledAssemblies = 0;
      let overdueReceivables = 0, upcomingReceivables = 0;
      let pendingCreditRequests = 0;

      if (isAdmin) {
        const { count: dc } = await supabase.from('deliveries').select('id', { count: 'exact' })
          .eq('store_id', currentStore.id).in('status', ['pending', 'assigned', 'out_for_delivery']);
        pendingDeliveries = dc || 0;

        const { count: ic } = await supabase.from('inventory').select('id', { count: 'exact' })
          .eq('store_id', currentStore.id).lt('qty_on_hand', 10);
        lowStockProducts = ic || 0;

        const { data: asmData } = await supabase.from('assemblies')
          .select('id, sale_id, status, scheduled_date, scheduled_time, assemblers(name)')
          .eq('account_id', currentAccount.id)
          .in('status', ['pending', 'scheduled', 'in_progress'])
          .order('created_at', { ascending: false }).limit(10);
        setAssemblyNotifications(asmData || []);
        pendingAssemblies = (asmData || []).filter(a => a.status === 'pending').length;
        scheduledAssemblies = (asmData || []).filter(a => a.status === 'scheduled').length;

        const { data: delData } = await supabase.from('deliveries')
          .select('id, sale_id, status, eta_at, drivers(name)')
          .eq('account_id', currentAccount.id)
          .in('status', ['pending', 'assigned', 'out_for_delivery'])
          .order('created_at', { ascending: false }).limit(10);
        setDeliveryNotifications(delData || []);

        const { count: orc } = await supabase.from('accounts_receivable').select('id', { count: 'exact' })
          .eq('account_id', currentAccount.id).eq('status', 'open').lt('due_date', today);
        overdueReceivables = orc || 0;

        const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
        const { count: urc } = await supabase.from('accounts_receivable').select('id', { count: 'exact' })
          .eq('account_id', currentAccount.id).eq('status', 'open')
          .gte('due_date', today).lte('due_date', nextWeek.toISOString().split('T')[0]);
        upcomingReceivables = urc || 0;

        // Credit override requests (for owner)
        if (isOwner) {
          const { data: crData } = await supabase.from('credit_override_requests')
            .select('*, customers(name)')
            .eq('account_id', currentAccount.id)
            .eq('status', 'pending')
            .order('requested_at', { ascending: false });
          setCreditRequests((crData || []) as any);
          pendingCreditRequests = (crData || []).length;
        }
      }

      let myCommissionsPending = 0, myCommissionsPaid = 0;
      if (isSeller) {
        const { data: cd } = await supabase.from('commissions').select('value, status').eq('seller_id', user.id);
        if (cd) {
          myCommissionsPending = cd.filter(c => c.status === 'pending').reduce((s, c) => s + (c.value || 0), 0);
          myCommissionsPaid = cd.filter(c => c.status === 'paid').reduce((s, c) => s + (c.value || 0), 0);
        }
      }

      setStats({ salesToday, revenueToday, netRevenueToday, salesMonth, revenueMonth, netRevenueMonth, pendingDeliveries, lowStockProducts, myCommissionsPending, myCommissionsPaid, pendingAssemblies, scheduledAssemblies, overdueReceivables, upcomingReceivables, pendingCreditRequests });

      let recentQuery = supabase.from('sales').select('id, total, status, created_at, customers(name)')
        .eq('store_id', currentStore.id).order('created_at', { ascending: false }).limit(5);
      if (isSeller) recentQuery = recentQuery.eq('seller_id', user.id);
      const { data: recentSalesData } = await recentQuery;
      setRecentSales(recentSalesData || []);
    } catch (error) { console.error('Error loading dashboard:', error); }
    finally { setLoading(false); }
  };

  const handleCreditAction = async (requestId: string, action: 'approved' | 'denied') => {
    setSaving(true);
    try {
      const updateData: any = {
        status: action,
        ...(action === 'approved' ? { approved_by: user?.id, approved_at: new Date().toISOString(), authorization_type: 'remote' } : { denied_by: user?.id, denied_at: new Date().toISOString() }),
      };
      const { error } = await supabase.from('credit_override_requests').update(updateData).eq('id', requestId);
      if (error) throw error;
      toast({ title: action === 'approved' ? 'Autorizado!' : 'Negado' });
      loadDashboardData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const statusColors: Record<string, string> = { draft: 'bg-status-draft', open: 'bg-status-open', paid: 'bg-status-paid', canceled: 'bg-status-canceled' };
  const statusLabels: Record<string, string> = { draft: 'Rascunho', open: 'Aberta', paid: 'Paga', canceled: 'Cancelada' };
  const asmStatusLabels: Record<string, string> = { pending: 'Pendente', scheduled: 'Agendada', in_progress: 'Em Andamento', completed: 'Concluída', canceled: 'Cancelada' };
  const asmStatusColors: Record<string, string> = { pending: 'bg-yellow-500', scheduled: 'bg-blue-500', in_progress: 'bg-purple-500', completed: 'bg-green-500', canceled: 'bg-red-500' };
  const delStatusLabels: Record<string, string> = { pending: 'Pendente', assigned: 'Atribuída', out_for_delivery: 'Em Rota', delivered: 'Entregue', canceled: 'Cancelada' };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
        <Loader2 className="h-10 w-10 animate-spin text-primary relative" />
      </div>
    </div>
  );

  const StatCard = ({ title, value, icon: Icon, gradient, iconBg, delay = 0, subtitle }: any) => (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-2xl transition-opacity duration-500 group-hover:opacity-20 ${gradient}`} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">{value}</p>
          {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
        </div>
        <div className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl ${iconBg} shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );

  const monthLabel = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Painel ao vivo</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Olá{profileName ? `, ${profileName.split(' ')[0]}` : (user?.email ? `, ${user.email.split('@')[0]}` : '')} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{isSeller ? 'Suas vendas e comissões' : `Visão geral de ${currentStore?.name}`}</p>
          </div>
          <MonthFilter currentMonth={month} onChange={setMonth} />
        </div>
      </div>


      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={isSeller ? 'Minhas Vendas (mês)' : 'Vendas no mês'}
          value={stats.salesMonth}
          subtitle={`${monthLabel} • Hoje: ${stats.salesToday}`}
          icon={ShoppingCart}
          gradient="bg-gradient-to-br from-blue-400 to-blue-600"
          iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
          delay={0}
        />
        <StatCard
          title={isSeller ? 'Meu Líquido (mês)' : 'Faturamento (mês)'}
          value={formatCurrency(isSeller ? stats.netRevenueMonth : stats.revenueMonth)}
          subtitle={isSeller
            ? `${monthLabel} • Hoje: ${formatCurrency(stats.netRevenueToday)}`
            : `Bruto • Líquido: ${formatCurrency(stats.netRevenueMonth)} • Hoje: ${formatCurrency(stats.revenueToday)}`}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
          delay={75}
        />
        {isSeller ? (
          <>
            <StatCard
              title="Comissões Pend."
              value={formatCurrency(stats.myCommissionsPending)}
              icon={Percent}
              gradient="bg-gradient-to-br from-amber-400 to-amber-600"
              iconBg="bg-gradient-to-br from-amber-500 to-amber-600"
              delay={150}
            />
            <StatCard
              title="Comissões Pagas"
              value={formatCurrency(stats.myCommissionsPaid)}
              icon={Percent}
              gradient="bg-gradient-to-br from-green-400 to-green-600"
              iconBg="bg-gradient-to-br from-green-500 to-green-600"
              delay={225}
            />
          </>
        ) : (
          <>
            {showDeliveries && (
              <StatCard
                title="Entregas Pend."
                value={stats.pendingDeliveries}
                icon={Truck}
                gradient="bg-gradient-to-br from-violet-400 to-violet-600"
                iconBg="bg-gradient-to-br from-violet-500 to-violet-600"
                delay={150}
              />
            )}
            <StatCard
              title="Estoque Baixo"
              value={stats.lowStockProducts}
              icon={Package}
              gradient="bg-gradient-to-br from-rose-400 to-rose-600"
              iconBg="bg-gradient-to-br from-rose-500 to-rose-600"
              delay={225}
            />
          </>
        )}
      </div>

      {/* Owner: Credit Override Requests */}
      {isOwner && showCrediario && creditRequests.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" /> Autorizações de Crediário Pendentes
              </CardTitle>
              <Badge className="bg-red-500 text-white text-xs">{creditRequests.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-2">
              {creditRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{req.customers?.name || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">
                      Venda: {formatCurrency(req.sale_amount)} | Excedente: {formatCurrency(req.excess_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Limite: {formatCurrency(req.current_limit)} | Utilizado: {formatCurrency(req.used_balance)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-300" onClick={() => handleCreditAction(req.id, 'approved')} disabled={saving}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-300" onClick={() => handleCreditAction(req.id, 'denied')} disabled={saving}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Notifications: Assembly + Delivery + Receivables */}
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Assembly Notifications */}
          {showAssemblies && <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="p-3 sm:p-6 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-purple-500" /> Montagens
                </CardTitle>
                <div className="flex gap-1">
                  {stats.pendingAssemblies > 0 && <Badge className="bg-yellow-500 text-white text-xs">{stats.pendingAssemblies} pend.</Badge>}
                  {stats.scheduledAssemblies > 0 && <Badge className="bg-blue-500 text-white text-xs">{stats.scheduledAssemblies} agend.</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {assemblyNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem montagens pendentes</p>
              ) : (
                <div className="space-y-2">
                  {assemblyNotifications.slice(0, 5).map(a => (
                    <Link key={a.id} to={`/app/sales/${a.sale_id}`} className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">Venda {a.sale_id.slice(0, 8).toUpperCase()}</p>
                        {a.assemblers?.name && <p className="text-xs text-muted-foreground">{a.assemblers.name}</p>}
                        {a.scheduled_date && <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(a.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}{a.scheduled_time ? ` ${a.scheduled_time}` : ''}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${asmStatusColors[a.status]} text-white text-xs`}>{asmStatusLabels[a.status]}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                <Link to="/app/assemblies">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>}

          {/* Delivery Notifications */}
          {showDeliveries && <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="p-3 sm:p-6 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-500" /> Entregas
                </CardTitle>
                {stats.pendingDeliveries > 0 && <Badge className="bg-blue-500 text-white text-xs">{stats.pendingDeliveries}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {deliveryNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem entregas pendentes</p>
              ) : (
                <div className="space-y-2">
                  {deliveryNotifications.slice(0, 5).map(d => (
                    <Link key={d.id} to={`/app/sales/${d.sale_id}`} className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">Venda {d.sale_id.slice(0, 8).toUpperCase()}</p>
                        {d.drivers?.name && <p className="text-xs text-muted-foreground">{d.drivers.name}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{delStatusLabels[d.status] || d.status}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                <Link to="/app/deliveries">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>}

          {/* Financial Alerts */}
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="p-3 sm:p-6 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" /> Financeiro
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
              {stats.overdueReceivables > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">{stats.overdueReceivables} parcela(s) atrasada(s)</p>
                  </div>
                </div>
              )}
              {stats.upcomingReceivables > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <Clock className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-700">{stats.upcomingReceivables} a vencer (7 dias)</p>
                  </div>
                </div>
              )}
              {stats.overdueReceivables === 0 && stats.upcomingReceivables === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Tudo em dia!</p>
              )}
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link to="/app/finance">Ver financeiro <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Faturamento últimos 7 dias */}
      <Last7DaysRevenueChart />

      {/* Recent Sales */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-base">{isSeller ? 'Minhas Vendas Recentes' : 'Vendas Recentes'}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          {recentSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma venda encontrada</p>
          ) : (
            <div className="space-y-2">
              {recentSales.map(sale => (
                <Link key={sale.id} to={`/app/sales/${sale.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors">
                  <div>
                    <p className="font-medium text-sm">{sale.customers?.name || 'Consumidor Final'}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(sale.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${statusColors[sale.status]} text-white text-xs`}>{statusLabels[sale.status]}</Badge>
                    <span className="font-semibold text-sm">{formatCurrency(sale.total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
