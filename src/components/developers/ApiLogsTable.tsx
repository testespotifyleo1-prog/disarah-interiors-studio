import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface LogRow {
  id: string;
  api_key_id: string | null;
  environment: string;
  method: string;
  path: string;
  query_params: Record<string, string> | null;
  status_code: number;
  latency_ms: number;
  ip: string | null;
  user_agent: string | null;
  error_code: string | null;
  created_at: string;
}

interface KeyOpt { id: string; name: string; key_prefix: string; environment: string; }

const PAGE_SIZE = 50;

function statusBadge(s: number) {
  if (s >= 500) return <Badge variant="destructive">{s}</Badge>;
  if (s >= 400) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">{s}</Badge>;
  if (s >= 300) return <Badge variant="secondary">{s}</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">{s}</Badge>;
}

export default function ApiLogsTable() {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id;
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [keys, setKeys] = useState<KeyOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filterKey, setFilterKey] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEnv, setFilterEnv] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LogRow | null>(null);

  useEffect(() => {
    if (!accountId) return;
    supabase.from('api_keys').select('id, name, key_prefix, environment').eq('account_id', accountId)
      .then(({ data }) => setKeys((data ?? []) as KeyOpt[]));
  }, [accountId]);

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    let q = supabase.from('api_request_logs')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    if (filterKey !== 'all') q = q.eq('api_key_id', filterKey);
    if (filterEnv !== 'all') q = q.eq('environment', filterEnv);
    if (filterStatus === '2xx') q = q.gte('status_code', 200).lt('status_code', 300);
    else if (filterStatus === '4xx') q = q.gte('status_code', 400).lt('status_code', 500);
    else if (filterStatus === '5xx') q = q.gte('status_code', 500);
    if (search.trim()) q = q.ilike('path', `%${search.trim()}%`);
    const { data } = await q;
    const rows = (data ?? []) as LogRow[];
    setHasMore(rows.length > PAGE_SIZE);
    setLogs(rows.slice(0, PAGE_SIZE));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [accountId, page, filterKey, filterStatus, filterEnv]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Logs de requisições</CardTitle>
            <CardDescription>Últimos 30 dias. Cada chamada à API pública é registrada.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setPage(0); load(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />Atualizar
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2">
          <Input placeholder="Buscar path…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
          <Select value={filterKey} onValueChange={(v) => { setFilterKey(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Chave" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as chaves</SelectItem>
              {keys.map(k => <SelectItem key={k.id} value={k.id}>{k.name} ({k.environment})</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEnv} onValueChange={(v) => { setFilterEnv(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Live + Test</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="test">Test</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="2xx">Sucesso (2xx)</SelectItem>
              <SelectItem value="4xx">Cliente (4xx)</SelectItem>
              <SelectItem value="5xx">Servidor (5xx)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma requisição encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr className="text-left">
                  <th className="py-2 pr-3">Quando</th>
                  <th className="pr-3">Método</th>
                  <th className="pr-3">Path</th>
                  <th className="pr-3">Status</th>
                  <th className="pr-3">Latência</th>
                  <th className="pr-3">Env</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(l)}>
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                    <td className="pr-3 font-mono text-xs">{l.method}</td>
                    <td className="pr-3 font-mono text-xs truncate max-w-[280px]">{l.path}</td>
                    <td className="pr-3">{statusBadge(l.status_code)}</td>
                    <td className="pr-3 text-xs">{l.latency_ms}ms</td>
                    <td className="pr-3"><Badge variant="outline" className="text-[10px]">{l.environment}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between pt-3">
          <span className="text-xs text-muted-foreground">Página {page + 1}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Detalhes da requisição</SheetTitle>
            <SheetDescription className="font-mono text-xs">{selected?.method} {selected?.path}</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="space-y-3 mt-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><div className="text-xs text-muted-foreground">Status</div>{statusBadge(selected.status_code)}</div>
                <div><div className="text-xs text-muted-foreground">Latência</div>{selected.latency_ms}ms</div>
                <div><div className="text-xs text-muted-foreground">Ambiente</div><Badge variant="outline">{selected.environment}</Badge></div>
                <div><div className="text-xs text-muted-foreground">Quando</div>{new Date(selected.created_at).toLocaleString('pt-BR')}</div>
              </div>
              {selected.error_code && (
                <div>
                  <div className="text-xs text-muted-foreground">Código do erro</div>
                  <code className="text-xs">{selected.error_code}</code>
                </div>
              )}
              {selected.query_params && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Query params</div>
                  <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">{JSON.stringify(selected.query_params, null, 2)}</pre>
                </div>
              )}
              {selected.ip && <div className="text-xs"><span className="text-muted-foreground">IP:</span> <code>{selected.ip}</code></div>}
              {selected.user_agent && <div className="text-xs break-all"><span className="text-muted-foreground">User-Agent:</span> <code>{selected.user_agent}</code></div>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
