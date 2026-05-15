import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Receipt, CheckCircle2, XCircle, AlertTriangle, Clock, Inbox, FileX2, Truck, HardDrive } from 'lucide-react';
import { MonthFilter, getMonthRange } from '@/components/MonthFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

type Stats = {
  authorized: number; canceled: number; rejected: number; processing: number; contingency: number;
  authorizedTotal: number; nfeCount: number; nfceCount: number;
};

const EMPTY: Stats = { authorized: 0, canceled: 0, rejected: 0, processing: 0, contingency: 0, authorizedTotal: 0, nfeCount: 0, nfceCount: 0 };

export default function FiscalDashboard() {
  const { currentAccount, currentStore, stores } = useAuth();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [destinedPending, setDestinedPending] = useState(0);
  const [mdfeOpen, setMdfeOpen] = useState(0);
  const [invalidations, setInvalidations] = useState(0);
  const [backupCount, setBackupCount] = useState(0);

  useEffect(() => { if (currentAccount) load(); }, [currentAccount, month, storeFilter, currentStore?.id]);

  const load = async () => {
    if (!currentAccount) return;
    setLoading(true);
    const { startISO, endISO } = getMonthRange(month);

    let storeIds: string[] = [];
    if (storeFilter !== 'all') storeIds = [storeFilter];
    else if (currentStore) storeIds = [currentStore.id];
    else {
      const { data: ss } = await supabase.from('stores').select('id').eq('account_id', currentAccount.id);
      storeIds = (ss || []).map(s => s.id);
    }

    if (storeIds.length === 0) { setStats(EMPTY); setLoading(false); return; }

    const { data: docs } = await supabase
      .from('fiscal_documents')
      .select('id, type, status, contingency_mode, sales!inner(total, created_at)')
      .in('store_id', storeIds)
      .gte('sales.created_at', startISO)
      .lte('sales.created_at', endISO);

    const s: Stats = { ...EMPTY };
    for (const d of (docs || []) as any[]) {
      const total = Number(d.sales?.total || 0);
      if (d.contingency_mode && d.status !== 'issued') s.contingency++;
      if (d.status === 'issued') {
        s.authorized++;
        s.authorizedTotal += total;
        if (d.type === 'nfe') s.nfeCount++;
        else if (d.type === 'nfce' || d.type === 'cupom') s.nfceCount++;
      } else if (d.status === 'cancelled') s.canceled++;
      else if (d.status === 'denied' || d.status === 'error') s.rejected++;
      else if (d.status === 'processing') s.processing++;
    }
    setStats(s);

    const [{ count: dp }, { count: mo }, { count: inv }, { count: bc }] = await Promise.all([
      supabase.from('nfe_destination_manifest').select('id', { count: 'exact', head: true }).in('store_id', storeIds).neq('status', 'manifested'),
      supabase.from('mdfe_documents').select('id', { count: 'exact', head: true }).in('store_id', storeIds).eq('status', 'authorized'),
      supabase.from('fiscal_invalidations').select('id', { count: 'exact', head: true }).in('store_id', storeIds).gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('fiscal_xml_backups').select('id', { count: 'exact', head: true }).eq('account_id', currentAccount.id),
    ]);
    setDestinedPending(dp || 0); setMdfeOpen(mo || 0); setInvalidations(inv || 0); setBackupCount(bc || 0);

    setLoading(false);
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const total = stats.authorized + stats.canceled + stats.rejected + stats.processing;
  const pct = (n: number) => total === 0 ? 0 : Math.round((n / total) * 100);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard Fiscal</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de toda a operação fiscal do mês.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
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
          {/* Status breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <StatCard icon={CheckCircle2} label="Autorizadas" value={stats.authorized} pct={pct(stats.authorized)} color="text-green-600" bg="bg-green-500/10 border-green-500/20" />
            <StatCard icon={Clock} label="Em processamento" value={stats.processing} pct={pct(stats.processing)} color="text-yellow-600" bg="bg-yellow-500/10 border-yellow-500/20" />
            <StatCard icon={AlertTriangle} label="Contingência" value={stats.contingency} pct={null} color="text-orange-600" bg="bg-orange-500/10 border-orange-500/20" />
            <StatCard icon={XCircle} label="Rejeitadas" value={stats.rejected} pct={pct(stats.rejected)} color="text-red-600" bg="bg-red-500/10 border-red-500/20" />
            <StatCard icon={XCircle} label="Canceladas" value={stats.canceled} pct={pct(stats.canceled)} color="text-muted-foreground" bg="bg-muted" />
          </div>

          {/* Big numbers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3"><FileText className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">NF-e (modelo 55)</p>
                  <p className="text-2xl font-bold text-primary">{stats.nfeCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-3"><Receipt className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">NFC-e (modelo 65)</p>
                  <p className="text-2xl font-bold text-green-600">{stats.nfceCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3"><CheckCircle2 className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Faturamento autorizado</p>
                  <p className="text-xl font-bold text-foreground">{fc(stats.authorizedTotal)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compliance shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conformidade</CardTitle>
              <CardDescription>Pendências e ações fiscais que exigem atenção do contador/dono.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <ShortcutCard
                icon={Inbox} label="NF-es Destinadas"
                value={destinedPending} pendingLabel="aguardando manifestação"
                href="/app/fiscal-extras" alert={destinedPending > 0}
              />
              <ShortcutCard
                icon={Truck} label="MDF-e em aberto"
                value={mdfeOpen} pendingLabel="aguardando encerramento"
                href="/app/fiscal-extras" alert={mdfeOpen > 0}
              />
              <ShortcutCard
                icon={FileX2} label="Inutilizações no mês"
                value={invalidations} pendingLabel="numerações inutilizadas"
                href="/app/fiscal-extras" alert={false}
              />
              <ShortcutCard
                icon={HardDrive} label="XMLs em backup"
                value={backupCount} pendingLabel="documentos arquivados"
                href="/app/fiscal-extras" alert={false}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, pct, color, bg }: any) {
  return (
    <Card className={`border ${bg}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className={`text-xl font-bold ${color}`}>{value}{pct !== null && <span className="text-xs ml-1 font-normal text-muted-foreground">({pct}%)</span>}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ShortcutCard({ icon: Icon, label, value, pendingLabel, href, alert }: any) {
  return (
    <Link to={href} className="block">
      <Card className={`hover:bg-accent transition-colors h-full ${alert ? 'border-destructive/50' : ''}`}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${alert ? 'text-destructive' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium">{label}</span>
            {alert && <Badge variant="destructive" className="text-[10px] ml-auto">!</Badge>}
          </div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{pendingLabel}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
