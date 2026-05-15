import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MonthFilter, getMonthRange } from '@/components/MonthFilter';
import {
  DollarSign, ShoppingCart, Package, Truck, Loader2,
  AlertTriangle, Clock, ArrowRight, TrendingUp, CalendarClock,
  CreditCard, PartyPopper,
} from 'lucide-react';
import { fetchExpirationAlertRows } from '@/utils/expirationAlerts';

interface TopProduct {
  product_id: string;
  product_name: string;
  total_qty: number;
  total_revenue: number;
}

interface ExpiringItem {
  id: string;
  product_name: string;
  qty_on_hand: number;
  expiration_date: string;
  days_left: number;
}

interface LowStockItem {
  id: string;
  product_name: string;
  qty_on_hand: number;
  min_qty: number;
}

interface PayableDue {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  supplier_name: string | null;
}

interface RecentSale {
  id: string;
  order_number: number | null;
  total: number;
  status: string;
  created_at: string;
  customers?: { name: string } | null;
}

interface DeliveryItem {
  id: string;
  sale_id: string;
  status: string;
  drivers?: { name: string } | null;
}

export default function PartyStoreDashboard() {
  const { user, currentAccount, currentStore, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());

  const [salesCount, setSalesCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [pendingDeliveries, setPendingDeliveries] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);

  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [payablesDue, setPayablesDue] = useState<PayableDue[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [overduePayables, setOverduePayables] = useState(0);

  const isSeller = userRole === 'seller';
  const isAdmin = !isSeller;

  useEffect(() => {
    if (currentAccount && currentStore) loadData();
  }, [currentAccount, currentStore, user, month]);

  const loadData = async () => {
    if (!currentAccount || !currentStore || !user) return;
    setLoading(true);
    const { startISO, endISO } = getMonthRange(month);
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const in30Str = in30Days.toISOString().split('T')[0];

    try {
      // 1. Sales stats
      let salesQ = supabase.from('sales').select('id, total')
        .eq('store_id', currentStore.id).in('status', ['paid', 'crediario'])
        .gte('created_at', startISO).lte('created_at', endISO);
      if (isSeller) salesQ = salesQ.eq('seller_user_id', user.id);
      const { data: salesData } = await salesQ;
      const sc = salesData?.length || 0;
      const rev = salesData?.reduce((s, v) => s + Number(v.total), 0) || 0;
      setSalesCount(sc);
      setRevenue(rev);
      setTicketMedio(sc > 0 ? rev / sc : 0);

      if (isAdmin) {
        // 2. Pending deliveries (online only)
        const { count: dc } = await supabase.from('deliveries').select('id', { count: 'exact' })
          .eq('store_id', currentStore.id).in('status', ['pending', 'assigned', 'out_for_delivery']);
        setPendingDeliveries(dc || 0);

        const { data: delData } = await supabase.from('deliveries')
          .select('id, sale_id, status, drivers(name)')
          .eq('store_id', currentStore.id)
          .in('status', ['pending', 'assigned', 'out_for_delivery'])
          .order('created_at', { ascending: false }).limit(5);
        setDeliveries(delData || []);

        // 3. Low stock
        const { data: lowData } = await supabase.from('inventory')
          .select('id, qty_on_hand, min_qty, products(name)')
          .eq('store_id', currentStore.id)
          .lt('qty_on_hand', 10)
          .order('qty_on_hand', { ascending: true })
          .limit(10);
        const mapped = (lowData || []).map((i: any) => ({
          id: i.id,
          product_name: i.products?.name || '—',
          qty_on_hand: i.qty_on_hand,
          min_qty: i.min_qty,
        }));
        setLowStockItems(mapped);
        setLowStockCount(mapped.length);

        // 4. Expiring products from batches and stock records
        const expRows = await fetchExpirationAlertRows({
          accountId: currentAccount.id,
          storeIds: [currentStore.id],
          withinDays: 90,
          limit: 15,
        });
        const expMapped = expRows.map((item) => ({
          id: item.id,
          product_name: item.product_name,
          qty_on_hand: item.quantity,
          expiration_date: item.expiration_date,
          days_left: item.days_left,
        }));
        setExpiringItems(expMapped);
        setExpiringCount(expMapped.length);

        // 5. Top selling products (month)
        const { data: saleIds } = await supabase.from('sales').select('id')
          .eq('store_id', currentStore.id).in('status', ['paid', 'crediario'])
          .gte('created_at', startISO).lte('created_at', endISO);
        if (saleIds && saleIds.length > 0) {
          const ids = saleIds.map(s => s.id);
          // Fetch in batches if needed
          const { data: itemsData } = await supabase.from('sale_items')
            .select('product_id, qty, total_line, products(name)')
            .in('sale_id', ids.slice(0, 200));
          if (itemsData) {
            const agg: Record<string, { name: string; qty: number; revenue: number }> = {};
            itemsData.forEach((it: any) => {
              const pid = it.product_id;
              if (!agg[pid]) agg[pid] = { name: it.products?.name || '—', qty: 0, revenue: 0 };
              agg[pid].qty += Number(it.qty);
              agg[pid].revenue += Number(it.total_line);
            });
            const sorted = Object.entries(agg)
              .map(([pid, v]) => ({ product_id: pid, product_name: v.name, total_qty: v.qty, total_revenue: v.revenue }))
              .sort((a, b) => b.total_revenue - a.total_revenue)
              .slice(0, 8);
            setTopProducts(sorted);
          }
        } else {
          setTopProducts([]);
        }

        // 6. Accounts payable
        const { data: payData } = await supabase.from('accounts_payable')
          .select('id, description, amount, due_date, status, supplier_name')
          .eq('account_id', currentAccount.id)
          .eq('status', 'open')
          .order('due_date', { ascending: true })
          .limit(8);
        setPayablesDue(payData || []);
        const overdue = (payData || []).filter(p => p.due_date < today).length;
        setOverduePayables(overdue);
      }

      // Recent sales
      let rq = supabase.from('sales').select('id, order_number, total, status, created_at, customers(name)')
        .eq('store_id', currentStore.id).order('created_at', { ascending: false }).limit(5);
      if (isSeller) rq = rq.eq('seller_user_id', user.id);
      const { data: recentData } = await rq;
      setRecentSales(recentData || []);

    } catch (e) { console.error('Dashboard error:', e); }
    finally { setLoading(false); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

  const statusLabels: Record<string, string> = { draft: 'Rascunho', open: 'Aberta', paid: 'Paga', canceled: 'Cancelada' };
  const statusColors: Record<string, string> = { draft: 'bg-muted text-muted-foreground', open: 'bg-blue-100 text-blue-700', paid: 'bg-green-100 text-green-700', canceled: 'bg-red-100 text-red-700' };
  const delLabels: Record<string, string> = { pending: 'Pendente', assigned: 'Atribuída', out_for_delivery: 'Em Rota' };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <PartyPopper className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{currentStore?.name}</p>
          </div>
        </div>
        <MonthFilter currentMonth={month} onChange={setMonth} />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 sm:p-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-2xl font-bold">{salesCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200/50 dark:from-green-900/10 dark:to-green-900/20 dark:border-green-800/30">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 sm:p-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Faturamento</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-400">{fmt(revenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 sm:p-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{fmt(ticketMedio)}</div>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card className={lowStockCount > 0 ? 'border-orange-200/50 bg-orange-50/30 dark:border-orange-800/30 dark:bg-orange-900/10' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 sm:p-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Estoque Baixo</CardTitle>
              <Package className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-orange-600' : ''}`}>{lowStockCount}</div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 sm:p-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Entregas Pend.</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-2xl font-bold">{pendingDeliveries}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {isAdmin && (
        <>
          {/* Alerts Row: Expiring + Low Stock */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Expiring Products Alert */}
            <Card className={`border-l-4 ${expiringCount > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
              <CardHeader className="p-3 sm:p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-red-500" />
                    Produtos Vencendo
                  </CardTitle>
                  {expiringCount > 0 && (
                    <Badge variant="destructive" className="text-xs">{expiringCount}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                {expiringItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">✅ Nenhum produto próximo ao vencimento</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                    {expiringItems.map(item => (
                      <div key={item.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                        item.days_left <= 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/40' :
                        item.days_left <= 30 ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800/40' :
                        'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/40'
                      }`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">Qtd: {item.qty_on_hand} • Vence: {fmtDate(item.expiration_date)}</p>
                        </div>
                        <Badge className={`text-xs flex-shrink-0 ${
                          item.days_left <= 0 ? 'bg-red-500 text-white' :
                          item.days_left <= 30 ? 'bg-orange-500 text-white' :
                          'bg-yellow-500 text-white'
                        }`}>
                          {item.days_left <= 0 ? '🗑️ Descartar' : item.days_left <= 30 ? '🔥 Saldão' : '🏷️ Promoção'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                  <Link to="/app/expiration-report">Ver relatório completo <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>

            {/* Low Stock Alert */}
            <Card className={`border-l-4 ${lowStockCount > 0 ? 'border-l-orange-500' : 'border-l-green-500'}`}>
              <CardHeader className="p-3 sm:p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-500" />
                    Estoque Baixo
                  </CardTitle>
                  {lowStockCount > 0 && (
                    <Badge className="bg-orange-500 text-white text-xs">{lowStockCount}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                {lowStockItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">✅ Estoque OK</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                    {lowStockItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-orange-50/50 border-orange-200/50 dark:bg-orange-900/10 dark:border-orange-800/30">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">Mínimo: {item.min_qty}</p>
                        </div>
                        <Badge className={`text-xs flex-shrink-0 ${item.qty_on_hand <= 0 ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                          {item.qty_on_hand <= 0 ? 'Zerado' : `${item.qty_on_hand} un`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                  <Link to="/app/inventory">Ver estoque <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Top Products + Accounts Payable */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Selling Products */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Produtos Mais Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sem vendas no período</p>
                ) : (
                  <div className="space-y-1.5">
                    {topProducts.map((p, i) => (
                      <div key={p.product_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                        <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          i === 0 ? 'bg-yellow-400 text-yellow-900' :
                          i === 1 ? 'bg-gray-300 text-gray-700' :
                          i === 2 ? 'bg-orange-300 text-orange-800' :
                          'bg-muted text-muted-foreground'
                        }`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.product_name}</p>
                          <p className="text-xs text-muted-foreground">{p.total_qty} vendido(s)</p>
                        </div>
                        <span className="text-sm font-semibold text-green-700 dark:text-green-400 flex-shrink-0">{fmt(p.total_revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                  <Link to="/app/products">Ver produtos <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>

            {/* Accounts Payable */}
            <Card className={`border-l-4 ${overduePayables > 0 ? 'border-l-red-500' : 'border-l-blue-500'}`}>
              <CardHeader className="p-3 sm:p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                    Contas a Pagar
                  </CardTitle>
                  {overduePayables > 0 && (
                    <Badge variant="destructive" className="text-xs">{overduePayables} atrasada(s)</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                {payablesDue.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">✅ Sem contas em aberto</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                    {payablesDue.map(p => {
                      const isOverdue = p.due_date < new Date().toISOString().split('T')[0];
                      return (
                        <div key={p.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                          isOverdue ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/40' : ''
                        }`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{p.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.supplier_name ? `${p.supplier_name} • ` : ''}{fmtDate(p.due_date)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : ''}`}>{fmt(p.amount)}</p>
                            {isOverdue && <p className="text-[10px] text-red-500 font-medium">Atrasada</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                  <Link to="/app/finance">Ver financeiro <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Deliveries */}
          {deliveries.length > 0 && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-500" /> Entregas Pendentes
                  </CardTitle>
                  <Badge className="bg-blue-500 text-white text-xs">{pendingDeliveries}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <div className="space-y-1.5">
                  {deliveries.map(d => (
                    <Link key={d.id} to={`/app/sales/${d.sale_id}`} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent transition-colors">
                      <div>
                        <p className="text-sm font-medium">Pedido {d.sale_id.slice(0, 8).toUpperCase()}</p>
                        {d.drivers?.name && <p className="text-xs text-muted-foreground">{d.drivers.name}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{delLabels[d.status] || d.status}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                  <Link to="/app/deliveries">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Recent Sales */}
      <Card>
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="text-sm sm:text-base">{isSeller ? 'Minhas Vendas Recentes' : 'Vendas Recentes'}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
          {recentSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma venda encontrada</p>
          ) : (
            <div className="space-y-1.5">
              {recentSales.map(sale => (
                <Link key={sale.id} to={`/app/sales/${sale.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors">
                  <div>
                    <p className="font-medium text-sm">{sale.customers?.name || 'Consumidor Final'}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.order_number ? `#${sale.order_number} • ` : ''}{new Date(sale.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${statusColors[sale.status]} text-xs`}>{statusLabels[sale.status]}</Badge>
                    <span className="font-semibold text-sm">{fmt(sale.total)}</span>
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
