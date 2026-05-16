import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isModuleDisabled } from '@/utils/accountModules';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Eye, Loader2, FileText, Receipt, ShoppingBag, ShoppingCart, Tag, FileX, CreditCard } from 'lucide-react';
import type { SaleWithDetails, SaleStatus } from '@/types/database';
import { MonthFilter, getMonthRange } from '@/components/MonthFilter';
import SmartPagination from '@/components/SmartPagination';
import { isMirandaEFarias, hasJpOrigin } from '@/lib/saleOrigin';

const PAGE_SIZE = 20;

const statusColors: Record<SaleStatus, string> = {
  draft: 'bg-status-draft',
  open: 'bg-status-open',
  paid: 'bg-status-paid',
  cancelled: 'bg-status-canceled',
  crediario: 'bg-orange-500',
  held: 'bg-yellow-500',
  returned: 'bg-gray-500',
};

const statusLabels: Record<SaleStatus, string> = {
  draft: 'Rascunho',
  open: 'Aberta',
  paid: 'Paga',
  cancelled: 'Cancelada',
  crediario: 'Crediário',
  held: 'Em espera',
  returned: 'Devolvida',
};

const isWooCommerceSale = (sale: SaleWithDetails) => {
  const source = String((sale as any).source || '').toLowerCase();
  const notes = String((sale as any).notes || '');
  return source === 'woocommerce' || notes.includes('[EXT:WC-') || /pedido\s+woocommerce/i.test(notes);
};

export default function Sales() {
  const { user, currentStore, currentAccount, userRole, canEdit } = useAuth();
  const showSource = currentAccount ? isModuleDisabled(currentAccount.id, 'auto_delivery') : false;
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'jp' | 'mf'>('all');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [nfeCount, setNfeCount] = useState(0);
  const [nfeTotal, setNfeTotal] = useState(0);
  const [nfceCount, setNfceCount] = useState(0);
  const [nfceTotal, setNfceTotal] = useState(0);
  const [fiscalBySale, setFiscalBySale] = useState<Record<string, { nfe: boolean; nfce: boolean }>>({});
  const [installmentReceipts, setInstallmentReceipts] = useState<Array<{
    id: string; sale_id: string; created_at: string; paid_value: number;
    method: string; notes: string | null; customer_name: string | null;
    sale_number: number | null;
  }>>([]);

  // Debounce search query for global search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (currentStore) loadSales();
  }, [currentStore, statusFilter, currentMonth, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, currentMonth, originFilter]);

  const loadSales = async () => {
    if (!currentStore) return;
    setLoading(true);
    const { startISO, endISO } = getMonthRange(currentMonth);
    const isGlobalSearch = debouncedSearch.length > 0;

    let query = supabase
      .from('sales')
      .select('*, customers(name), stores(name)')
      .eq('store_id', currentStore.id)
      .order('created_at', { ascending: false });

    // Apply month filter only when NOT searching globally
    if (!isGlobalSearch) {
      query = query.gte('created_at', startISO).lte('created_at', endISO);
    } else {
      const q = debouncedSearch;
      const isNumeric = /^\d+$/.test(q);
      if (isNumeric) {
        query = query.eq('sale_number', Number(q));
      } else {
        // non-numeric: try sale uuid exact match if it looks like one, otherwise skip here (customer name handled below)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
        if (isUuid) query = query.eq('id', q);
        else query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // empty result, customer search will fill
      }
      query = query.limit(200);
    }

    if (userRole === 'seller' && user) {
      query = query.eq('seller_id', user.id);
    }
    if (statusFilter !== 'all' && ['draft', 'open', 'paid', 'cancelled'].includes(statusFilter)) {
      query = query.eq('status', statusFilter as SaleStatus);
    }
    let { data } = await query;

    // Also search by customer name (separate query, since join filters need different syntax)
    if (isGlobalSearch && !/^\d+$/.test(debouncedSearch)) {
      const { data: byCustomer } = await supabase
        .from('sales')
        .select('*, customers!inner(name), stores(name)')
        .eq('store_id', currentStore.id)
        .ilike('customers.name', `%${debouncedSearch}%`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (byCustomer) {
        const seen = new Set((data || []).map((s: any) => s.id));
        data = [...(data || []), ...byCustomer.filter((s: any) => !seen.has(s.id))] as any;
      }
    }
    if (data) {
      setSales(data as unknown as SaleWithDetails[]);
      // Load seller names
      const sellerIds = [...new Set((data as any[]).map(s => s.seller_id).filter(Boolean))];
      if (sellerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', sellerIds);
        if (profiles) {
          const map: Record<string, string> = {};
          profiles.forEach((p: any) => { map[p.user_id] = p.full_name || 'Sem nome'; });
          setSellerNames(map);
        }
      }
    }

    // Load fiscal documents with type info
    const { data: fiscalDocs } = await supabase
      .from('fiscal_documents')
      .select('sale_id, type')
      .eq('store_id', currentStore.id)
      .in('status', ['processing', 'issued', 'completed', 'authorized']);

    if (fiscalDocs && data) {
      const salesMap = new Map((data as any[]).map(s => [s.id, s]));
      let nfeC = 0, nfeT = 0, nfceC = 0, nfceT = 0;
      const counted = new Set<string>();
      const bySale: Record<string, { nfe: boolean; nfce: boolean }> = {};
      for (const fd of fiscalDocs) {
        const sale = salesMap.get(fd.sale_id);
        if (!sale) continue;
        if (!bySale[fd.sale_id]) bySale[fd.sale_id] = { nfe: false, nfce: false };
        if (fd.type === 'nfe') bySale[fd.sale_id].nfe = true;
        else if (fd.type === 'nfce' || fd.type === 'cupom') bySale[fd.sale_id].nfce = true;

        if (counted.has(`${fd.sale_id}_${fd.type}`)) continue;
        counted.add(`${fd.sale_id}_${fd.type}`);
        if (sale.status === 'cancelled') continue;
        if (fd.type === 'nfe') { nfeC++; nfeT += sale.total || 0; }
        else if (fd.type === 'nfce' || fd.type === 'cupom') { nfceC++; nfceT += sale.total || 0; }
      }
      setNfeCount(nfeC); setNfeTotal(nfeT);
      setNfceCount(nfceC); setNfceTotal(nfceT);
      setFiscalBySale(bySale);
    } else {
      setNfeCount(0); setNfeTotal(0); setNfceCount(0); setNfceTotal(0);
      setFiscalBySale({});
    }

    // Load installment receipts (crediário payments) for this store within month
    if (!isGlobalSearch) {
      const { data: pays } = await supabase
        .from('payments')
        .select('id, sale_id, paid_value, method, notes, created_at, sales!inner(id, store_id, sale_number, customer_id, customers(name))')
        .eq('sales.store_id', currentStore.id)
        .ilike('notes', 'Recebimento Crediário%')
        .gte('created_at', startISO).lte('created_at', endISO)
        .order('created_at', { ascending: false })
        .limit(500);
      const enriched = (pays || []).map((p: any) => ({
        id: p.id,
        sale_id: p.sale_id,
        created_at: p.created_at,
        paid_value: Number(p.paid_value) || 0,
        method: p.method,
        notes: p.notes,
        customer_name: p.sales?.customers?.name || null,
        sale_number: p.sales?.sale_number ?? null,
      }));
      setInstallmentReceipts(enriched);
    } else {
      setInstallmentReceipts([]);
    }

    setLoading(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('pt-BR');

  const showJpFilter = isMirandaEFarias(currentStore?.name);

  const filteredSales = useMemo(() => sales.filter(sale => {
    const isJp = hasJpOrigin((sale as any).notes);
    if (showJpFilter) {
      if (originFilter === 'jp' && !isJp) return false;
      if (originFilter === 'mf' && isJp) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const orderNum = String((sale as any).sale_number || '');
    // Numeric => exact match on order number (precision)
    if (/^\d+$/.test(q)) {
      return orderNum === q || sale.id.toLowerCase().includes(q);
    }
    return sale.customers?.name?.toLowerCase().includes(q) || sale.id.toLowerCase().includes(q);
  }), [sales, searchQuery, originFilter, showJpFilter]);

  const jpSummary = useMemo(() => {
    if (!showJpFilter) return { count: 0, total: 0 };
    return sales.reduce(
      (acc, s) => hasJpOrigin((s as any).notes) && s.status !== 'cancelled'
        ? { count: acc.count + 1, total: acc.total + Number(s.total || 0) }
        : acc,
      { count: 0, total: 0 }
    );
  }, [sales, showJpFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const pagedSales = filteredSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Vendas</h1>
        <p className="text-sm text-muted-foreground">
          {userRole === 'seller' ? 'Suas vendas' : 'Todas as vendas da loja'}
        </p>
      </div>

      {/* Resumo fiscal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NF-e Emitidas</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(nfeTotal)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Qtd</p>
              <p className="text-lg font-semibold text-foreground">{nfeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-full bg-green-500/10 p-3">
              <Receipt className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cupons Fiscais (NFC-e)</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(nfceTotal)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Qtd</p>
              <p className="text-lg font-semibold text-foreground">{nfceCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showJpFilter && (
        <Card className="border-orange-300 bg-orange-50/60 dark:bg-orange-950/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-full bg-orange-500/15 p-3">
              <Tag className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-orange-700/80 dark:text-orange-300/80">Vendas marcadas como JP Móveis (no mês)</p>
              <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{formatCurrency(jpSummary.total)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-orange-700/80 dark:text-orange-300/80">Qtd</p>
              <p className="text-lg font-semibold text-orange-700 dark:text-orange-300">{jpSummary.count}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {installmentReceipts.length > 0 && (
        <Card className="border-purple-200">
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-600" />
              Recebimentos de Crediário no Mês
              <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700 ml-1">
                {installmentReceipts.length}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Parcelas pagas pelos clientes — entram no caixa do dia, mas não são vendas novas.
            </p>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-2">
              {installmentReceipts.map(r => {
                const methodLabel = r.method === 'cash' ? 'Dinheiro'
                  : r.method === 'pix' ? 'PIX'
                  : r.method === 'card' ? 'Cartão'
                  : r.method === 'crediario' ? 'Crediário'
                  : r.method === 'financeira' ? 'Financeira'
                  : r.method === 'store_credit' ? 'Crédito de loja'
                  : r.method;
                // Extract installment info from notes ("Recebimento Crediário - Parcela X/Y - Cliente")
                const parcelaMatch = r.notes?.match(/Parcela\s+(\d+(?:\/\d+)?)/i);
                const parcelaTxt = parcelaMatch ? `Parcela ${parcelaMatch[1]}` : 'Parcela';
                return (
                  <div key={r.id} className="border rounded-lg p-3 bg-purple-50/30 hover:bg-purple-50/60 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          <span className="text-purple-700 font-semibold mr-1">[{parcelaTxt} paga]</span>
                          {r.customer_name || 'Cliente'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(r.created_at)} • {methodLabel}
                          {r.sale_number ? ` • Venda #${r.sale_number}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-green-700 whitespace-nowrap">
                        {formatCurrency(r.paid_value)}
                      </span>
                      <Button variant="ghost" size="sm" asChild title="Ver venda original">
                        <Link to={`/app/sales/${r.sale_id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base sm:text-lg">Lista de Vendas</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <MonthFilter currentMonth={currentMonth} onChange={setCurrentMonth} />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Nº pedido, cliente..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full sm:w-[220px]" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="open">Aberta</SelectItem>
                  <SelectItem value="paid">Paga</SelectItem>
                  <SelectItem value="canceled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              {showJpFilter && (
                <Select value={originFilter} onValueChange={(v) => setOriginFilter(v as 'all' | 'jp' | 'mf')}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as origens</SelectItem>
                    <SelectItem value="mf">Só Miranda e Farias</SelectItem>
                    <SelectItem value="jp">Só JP Móveis (temp)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma venda encontrada</div>
          ) : (
            <>
              {/* Mobile: card layout */}
              <div className="space-y-2 sm:hidden">
                {pagedSales.map(sale => (
                  <Link key={sale.id} to={`/app/sales/${sale.id}`} className="block">
                    <div className="border rounded-lg p-3 hover:bg-accent transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          <span className="text-muted-foreground mr-1">#{(sale as any).sale_number || '—'}</span>
                          {sale.customers?.name || 'Consumidor Final'}
                        </span>
                        <div className="flex items-center gap-1">
                          {showSource && (
                            <Badge variant="outline" className={`text-xs ${(sale as any).source === 'woocommerce' ? 'border-purple-500 text-purple-600' : (sale as any).source === 'ecommerce' ? 'border-blue-500 text-blue-600' : 'border-muted-foreground'}`}>
                              {(sale as any).source === 'woocommerce' ? (
                                <><ShoppingBag className="h-3 w-3 mr-1" />WooCommerce</>
                              ) : (sale as any).source === 'ecommerce' ? (
                                <><ShoppingBag className="h-3 w-3 mr-1" />Online</>
                              ) : (
                                <><ShoppingCart className="h-3 w-3 mr-1" />PDV</>
                              )}
                            </Badge>
                          )}
                          {isWooCommerceSale(sale) && (
                            <Badge variant="outline" className="text-xs border-primary text-primary" title="Pedido importado do WooCommerce">
                              <ShoppingBag className="h-3 w-3 mr-1" />WooCommerce
                            </Badge>
                          )}
                          {showJpFilter && hasJpOrigin((sale as any).notes) && (
                            <Badge className="bg-orange-500 text-white text-xs">JP</Badge>
                          )}
                          <Badge className={`${statusColors[sale.status]} text-white text-xs`}>
                            {statusLabels[sale.status]}
                          </Badge>
                          {sale.status !== 'cancelled' && sale.status !== 'draft' && (
                            fiscalBySale[sale.id]?.nfe ? (
                              <Badge className="bg-primary text-primary-foreground text-xs" title="NF-e emitida"><FileText className="h-3 w-3 mr-1" />NF-e</Badge>
                            ) : fiscalBySale[sale.id]?.nfce ? (
                              <Badge className="bg-green-600 text-white text-xs" title="NFC-e (Cupom) emitido"><Receipt className="h-3 w-3 mr-1" />NFC-e</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600" title="Sem nota emitida"><FileX className="h-3 w-3 mr-1" />Sem nota</Badge>
                            )
                          )}
                        </div>
                      </div>
                       <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(sale.created_at)}</span>
                        <span className="font-medium text-foreground">{formatCurrency(sale.total)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Vendedor(a): {sellerNames[(sale as any).seller_id] || '—'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                     <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">Nº</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Data</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Vendedor(a)</th>
                      {showSource && <th className="text-left py-2 font-medium text-muted-foreground">Origem</th>}
                      <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
                      <th className="w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSales.map(sale => (
                      <tr key={sale.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 font-medium text-muted-foreground">#{(sale as any).sale_number || '—'}</td>
                        <td className="py-2 whitespace-nowrap">{formatDate(sale.created_at)}</td>
                        <td className="py-2">{sale.customers?.name || 'Consumidor Final'}</td>
                        <td className="py-2">{sellerNames[(sale as any).seller_id] || '—'}</td>
                        {showSource && (
                          <td className="py-2">
                            <Badge variant="outline" className={`text-xs ${(sale as any).source === 'woocommerce' ? 'border-purple-500 text-purple-600' : (sale as any).source === 'ecommerce' ? 'border-blue-500 text-blue-600' : 'border-muted-foreground'}`}>
                              {(sale as any).source === 'woocommerce' ? (
                                <><ShoppingBag className="h-3 w-3 mr-1" />WooCommerce</>
                              ) : (sale as any).source === 'ecommerce' ? (
                                <><ShoppingBag className="h-3 w-3 mr-1" />Online</>
                              ) : (
                                <><ShoppingCart className="h-3 w-3 mr-1" />PDV</>
                              )}
                            </Badge>
                          </td>
                        )}
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            {isWooCommerceSale(sale) && (
                              <Badge variant="outline" className="border-primary text-primary" title="Pedido importado do WooCommerce">
                                <ShoppingBag className="h-3 w-3 mr-1" />WooCommerce
                              </Badge>
                            )}
                            {showJpFilter && hasJpOrigin((sale as any).notes) && (
                              <Badge className="bg-orange-500 text-white" title="Venda da JP Móveis (faturada aqui temporariamente)">JP</Badge>
                            )}
                            <Badge className={`${statusColors[sale.status]} text-white`}>{statusLabels[sale.status]}</Badge>
                            {sale.status !== 'cancelled' && sale.status !== 'draft' && (
                              fiscalBySale[sale.id]?.nfe ? (
                                <Badge className="bg-primary text-primary-foreground" title="NF-e emitida"><FileText className="h-3 w-3 mr-1" />NF-e</Badge>
                              ) : fiscalBySale[sale.id]?.nfce ? (
                                <Badge className="bg-green-600 text-white" title="NFC-e (Cupom) emitido"><Receipt className="h-3 w-3 mr-1" />NFC-e</Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-500 text-amber-600" title="Sem nota emitida"><FileX className="h-3 w-3 mr-1" />Sem nota</Badge>
                              )
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-right font-medium">{formatCurrency(sale.total)}</td>
                        <td className="py-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/app/sales/${sale.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <SmartPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredSales.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
