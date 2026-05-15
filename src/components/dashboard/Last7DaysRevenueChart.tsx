import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Point {
  day: string;
  fullDate: string;
  total: number;
}

const BRAND = '#C45E1A';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function Last7DaysRevenueChart() {
  const { currentStore, user, userRole } = useAuth();
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!currentStore) return;
    const load = async () => {
      setLoading(true);
      try {
        const start = startOfDay(subDays(new Date(), 6));
        const end = endOfDay(new Date());

        let query = supabase
          .from('sales')
          .select('total, created_at')
          .eq('store_id', currentStore.id)
          .in('status', ['paid', 'crediario'])
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        if (userRole === 'seller' && user?.id) {
          query = query.eq('seller_id', user.id);
        }

        const { data: sales } = await query;

        // Build buckets for the last 7 days (oldest -> newest)
        const buckets: Point[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = subDays(new Date(), i);
          buckets.push({
            day: format(d, 'EEE', { locale: ptBR }).replace('.', ''),
            fullDate: format(d, 'dd/MM', { locale: ptBR }),
            total: 0,
          });
        }

        (sales || []).forEach((s: any) => {
          const d = new Date(s.created_at);
          const idx = 6 - Math.floor((endOfDay(new Date()).getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
          if (idx >= 0 && idx < 7) buckets[idx].total += Number(s.total || 0);
        });

        // Capitalize labels
        buckets.forEach(b => { b.day = b.day.charAt(0).toUpperCase() + b.day.slice(1); });

        setData(buckets);
        setTotal(buckets.reduce((s, b) => s + b.total, 0));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentStore?.id, user?.id, userRole]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3 sm:p-6 pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: BRAND }} />
            Faturamento dos últimos 7 dias
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Total: <span className="font-semibold" style={{ color: BRAND }}>{formatCurrency(total)}</span>
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 pt-0">
        {loading ? (
          <div className="flex items-center justify-center h-[220px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="brandFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  tickFormatter={(v) =>
                    v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(0)}`
                  }
                />
                <Tooltip
                  cursor={{ stroke: BRAND, strokeWidth: 1, strokeDasharray: '3 3' }}
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  labelFormatter={(label, items: any) => {
                    const d = items?.[0]?.payload?.fullDate;
                    return `${label}${d ? ` • ${d}` : ''}`;
                  }}
                  formatter={(v: any) => [formatCurrency(Number(v)), 'Faturamento']}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={BRAND}
                  strokeWidth={2.5}
                  fill="url(#brandFill)"
                  dot={{ r: 3, fill: BRAND, stroke: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: BRAND, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
