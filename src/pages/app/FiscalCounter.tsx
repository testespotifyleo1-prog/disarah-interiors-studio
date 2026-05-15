import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Receipt, FileX2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { MonthFilter, getMonthRange } from '@/components/MonthFilter';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export default function FiscalCounter() {
  const { currentAccount, currentStore, stores } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [storeFilter, setStoreFilter] = useState('all');
  const [nfeCount, setNfeCount] = useState(0);
  const [nfeTotal, setNfeTotal] = useState(0);
  const [nfceCount, setNfceCount] = useState(0);
  const [nfceTotal, setNfceTotal] = useState(0);
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    if (currentAccount) loadData();
  }, [currentAccount, month, storeFilter]);

  const loadData = async () => {
    if (!currentAccount) return;
    setLoading(true);
    const { startISO, endISO } = getMonthRange(month);

    let query = supabase
      .from('fiscal_documents')
      .select('id, sale_id, type, status, created_at, nfe_number, access_key, sales!inner(total, order_number, status, created_at)')
      .in('status', ['processing', 'issued', 'completed', 'authorized'])
      // Filtra pelo mês da VENDA (alinha com a tela de Vendas)
      .gte('sales.created_at', startISO)
      .lte('sales.created_at', endISO)
      .order('created_at', { ascending: false });

    if (storeFilter !== 'all') {
      query = query.eq('store_id', storeFilter);
    } else if (currentStore) {
      query = query.eq('store_id', currentStore.id);
    }

    const { data } = await query;
    const items = (data || []) as any[];

    // Dedupe: 1 documento por (sale_id, type) — pega o mais recente
    const seen = new Set<string>();
    const dedup: any[] = [];
    for (const fd of items) {
      const key = `${fd.sale_id}_${fd.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(fd);
    }
    setDocs(dedup);

    let nc = 0, nt = 0, ncc = 0, nct = 0;
    for (const fd of dedup) {
      if (fd.sales?.status === 'canceled') continue;
      const total = Number(fd.sales?.total || 0);
      if (fd.type === 'nfe') { nc++; nt += total; }
      else if (fd.type === 'nfce' || fd.type === 'cupom') { ncc++; nct += total; }
    }
    setNfeCount(nc); setNfeTotal(nt); setNfceCount(ncc); setNfceTotal(nct);
    setLoading(false);
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Contador Fiscal</h1>
          <p className="text-sm text-muted-foreground">Notas fiscais emitidas por mês</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link to="/app/fiscal-extras"><FileX2 className="mr-1 h-3 w-3" /> Inutilizar Numeração</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link to="/app/fiscal-extras"><Wrench className="mr-1 h-3 w-3" /> Ferramentas</Link>
          </Button>
          <MonthFilter currentMonth={month} onChange={setMonth} />
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Loja" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Loja Atual</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3"><FileText className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">NF-e Emitidas</p>
                  <p className="text-2xl font-bold text-primary">{nfeCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3"><FileText className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total NF-e</p>
                  <p className="text-xl font-bold text-primary">{fc(nfeTotal)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-3"><Receipt className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Cupons (NFC-e)</p>
                  <p className="text-2xl font-bold text-green-600">{nfceCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-3"><Receipt className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total NFC-e</p>
                  <p className="text-xl font-bold text-green-600">{fc(nfceTotal)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-2">
              <CardTitle className="text-base">Documentos Emitidos ({docs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {docs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum documento neste mês</p>
              ) : (
                <div className="space-y-2">
                  {docs.map(d => (
                    <div key={d.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        {d.type === 'nfe' ? <FileText className="h-4 w-4 text-primary" /> : <Receipt className="h-4 w-4 text-green-600" />}
                        <div>
                          <p className="text-sm font-medium">
                            {d.type === 'nfe' ? 'NF-e' : 'NFC-e'} {d.nfe_number ? `#${d.nfe_number}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Pedido #{d.sales?.order_number || '—'} • {new Date(d.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{fc(d.sales?.total || 0)}</p>
                        <Badge variant="outline" className="text-xs">{d.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
