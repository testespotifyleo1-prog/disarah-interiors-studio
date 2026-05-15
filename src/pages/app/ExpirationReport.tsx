import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SmartPagination from '@/components/SmartPagination';
import { Loader2, Search, AlertTriangle, Clock, Trash2, Tag, Download } from 'lucide-react';
import { ExpirationAlertRow, fetchExpirationAlertRows, formatExpirationDate } from '@/utils/expirationAlerts';

type ExpirationRow = ExpirationAlertRow;

const PAGE_SIZE = 50;

export default function ExpirationReport() {
  const { currentAccount, stores } = useAuth();
  const [rows, setRows] = useState<ExpirationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  const [filterAlert, setFilterAlert] = useState('all');
  const [page, setPage] = useState(1);
  const visibleStoreIds = stores.map(store => store.id);
  const storeScope = visibleStoreIds.join('|');

  useEffect(() => {
    if (currentAccount && visibleStoreIds.length > 0) loadData();
  }, [currentAccount?.id, storeScope]);

  const loadData = async () => {
    if (!currentAccount || visibleStoreIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const mapped = await fetchExpirationAlertRows({
        accountId: currentAccount.id,
        storeIds: visibleStoreIds,
      });
      setRows(mapped);
    } catch (error) {
      console.error('Erro ao carregar validades:', error);
      setRows([]);
    }

    setLoading(false);
  };

  const filtered = rows.filter(r => {
    if (filterStore !== 'all' && r.store_name !== filterStore) return false;
    if (filterAlert !== 'all' && r.alert_type !== filterAlert) return false;
    if (search && !r.product_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const alertLabel = (t: ExpirationRow['alert_type']) => {
    switch (t) {
      case 'promo': return { text: '🏷️ Promoção', cls: 'bg-yellow-500 text-white' };
      case 'saldao': return { text: '🔥 Saldão', cls: 'bg-orange-500 text-white' };
      case 'descartar': return { text: '🗑️ Descartar', cls: 'bg-red-600 text-white' };
      default: return { text: '✅ OK', cls: 'bg-green-500 text-white' };
    }
  };

  const exportCsv = () => {
    const header = 'Produto;Lote;Loja;Validade;Dias Restantes;Qtd;Status\n';
    const lines = filtered.map(r =>
      `${r.product_name};${r.batch_label || ''};${r.store_name};${formatExpirationDate(r.expiration_date)};${r.days_left};${r.quantity};${alertLabel(r.alert_type).text}`
    ).join('\n');
    const blob = new Blob([header + lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const storeNames = [...new Set(rows.map(r => r.store_name))].sort();

  const countByAlert = (t: string) => rows.filter(r => r.alert_type === t).length;

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Controle de Validade</h1>
        <p className="text-sm text-muted-foreground">Relatório de produtos por data de validade</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">OK</p>
            <p className="text-2xl font-bold text-green-600">{countByAlert('ok')}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Promoção (≤3m)</p>
            <p className="text-2xl font-bold text-yellow-600">{countByAlert('promo')}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Saldão (≤1m)</p>
            <p className="text-2xl font-bold text-orange-600">{countByAlert('saldao')}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Trash2 className="h-3 w-3" /> Descartar</p>
            <p className="text-2xl font-bold text-red-600">{countByAlert('descartar')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
            </div>
          </div>
          <Select value={filterStore} onValueChange={v => { setFilterStore(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Loja" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {storeNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAlert} onValueChange={v => { setFilterAlert(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="promo">🏷️ Promoção</SelectItem>
              <SelectItem value="saldao">🔥 Saldão</SelectItem>
              <SelectItem value="descartar">🗑️ Descartar</SelectItem>
              <SelectItem value="ok">✅ OK</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum registro de validade encontrado</TableCell></TableRow>
              ) : paged.map(r => {
                const al = alertLabel(r.alert_type);
                return (
                  <TableRow key={r.id} className={r.alert_type === 'descartar' ? 'bg-red-50/50 dark:bg-red-900/10' : r.alert_type === 'saldao' ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}>
                    <TableCell className="font-medium">{r.product_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.batch_label || '—'}</TableCell>
                    <TableCell>{r.store_name}</TableCell>
                    <TableCell>{formatExpirationDate(r.expiration_date)}</TableCell>
                    <TableCell className={r.days_left <= 0 ? 'text-red-600 font-bold' : r.days_left <= 30 ? 'text-orange-600 font-semibold' : ''}>
                      {r.days_left <= 0 ? 'Vencido' : `${r.days_left}d`}
                    </TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell><Badge className={`${al.cls} text-xs`}>{al.text}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <SmartPagination currentPage={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}
    </div>
  );
}
