import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, Clock, KeyRound } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';

interface Stats {
  totals: { total_calls: number; errors: number; avg_latency_ms: number; p95_latency_ms: number };
  by_day: Array<{ day: string; ok: number; client_err: number; server_err: number }>;
  top_endpoints: Array<{ endpoint: string; calls: number }>;
  top_keys: Array<{ key_name: string | null; key_prefix: string | null; environment: string; calls: number }>;
}

const PERIODS = [
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Últimos 90 dias', days: 90 },
];

export default function ApiUsageDashboard() {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id;
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(7);
  const [env, setEnv] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    const to = new Date();
    const from = new Date(); from.setDate(to.getDate() - days);
    const { data, error } = await supabase.rpc('get_api_usage_stats', {
      _account_id: accountId,
      _from: from.toISOString(),
      _to: to.toISOString(),
      _environment: env === 'all' ? null : env,
    });
    if (!error) setStats(data as unknown as Stats);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [accountId, days, env]);

  const totals = stats?.totals ?? { total_calls: 0, errors: 0, avg_latency_ms: 0, p95_latency_ms: 0 };
  const errorRate = totals.total_calls ? ((totals.errors / totals.total_calls) * 100).toFixed(1) : '0.0';
  const topKey = stats?.top_keys?.[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={env} onValueChange={setEnv}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Live + Test</SelectItem>
              <SelectItem value="live">Apenas Live</SelectItem>
              <SelectItem value="test">Apenas Test</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" />Chamadas</div>
          <div className="text-2xl font-bold mt-1">{totals.total_calls.toLocaleString('pt-BR')}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />Taxa de erro</div>
          <div className="text-2xl font-bold mt-1">{errorRate}%</div>
          <div className="text-xs text-muted-foreground">{totals.errors} erros</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Latência média</div>
          <div className="text-2xl font-bold mt-1">{totals.avg_latency_ms}ms</div>
          <div className="text-xs text-muted-foreground">p95: {totals.p95_latency_ms}ms</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><KeyRound className="h-3.5 w-3.5" />Chave mais ativa</div>
          <div className="text-base font-semibold mt-1 truncate">{topKey?.key_name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{topKey ? `${topKey.calls.toLocaleString('pt-BR')} chamadas` : 'sem dados'}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chamadas por dia</CardTitle>
          <CardDescription>Empilhado por classe de status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !stats ? <div className="h-64 grid place-items-center text-sm text-muted-foreground">Carregando…</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.by_day}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="ok" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} name="2xx" />
                <Area type="monotone" dataKey="client_err" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} name="4xx" />
                <Area type="monotone" dataKey="server_err" stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.4} name="5xx" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Top endpoints</CardTitle></CardHeader>
          <CardContent>
            {!stats?.top_endpoints?.length ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.top_endpoints} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="endpoint" tick={{ fontSize: 10 }} width={180} />
                  <Tooltip />
                  <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top chaves</CardTitle></CardHeader>
          <CardContent>
            {!stats?.top_keys?.length ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <div className="space-y-2">
                {stats.top_keys.map((k, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2 rounded border">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        {k.key_name ?? '(removida)'}
                        <Badge variant="outline" className="text-[10px]">{k.environment}</Badge>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground truncate">{k.key_prefix ?? '—'}</div>
                    </div>
                    <div className="text-sm font-semibold whitespace-nowrap">{k.calls.toLocaleString('pt-BR')}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
