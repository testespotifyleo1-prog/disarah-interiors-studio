import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Crown, Building2, Save } from 'lucide-react';
import type { Plan } from '@/utils/planFeatures';

interface AccountWithPlan {
  id: string;
  name: string;
  plan_id: string | null;
  plan_name: string | null;
  plan_slug: string | null;
  created_at: string;
}

export function PlanManagement() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [accounts, setAccounts] = useState<AccountWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [plansRes, accountsRes] = await Promise.all([
      supabase.from('plans').select('*').order('sort_order'),
      supabase.from('accounts').select('*').order('name'),
    ]);

    const plansData = (plansRes.data || []) as unknown as Plan[];
    setPlans(plansData);

    const planMap = new Map(plansData.map(p => [p.id, p]));
    const accts: AccountWithPlan[] = (accountsRes.data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      plan_id: a.plan_id,
      plan_name: a.plan_id ? planMap.get(a.plan_id)?.name || null : null,
      plan_slug: a.plan_id ? planMap.get(a.plan_id)?.slug || null : null,
      created_at: a.created_at,
    }));

    setAccounts(accts);
    setLoading(false);
  };

  const handlePlanChange = async (accountId: string, planId: string | null) => {
    setSaving(accountId);
    const { error } = await supabase
      .from('accounts')
      .update({ plan_id: planId || null } as any)
      .eq('id', accountId);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Plano atualizado com sucesso!' });
      loadData();
    }
    setSaving(null);
  };

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const legacyCount = accounts.filter(a => !a.plan_id).length;
  const withPlan = accounts.filter(a => !!a.plan_id).length;

  const planColors: Record<string, string> = {
    start: 'bg-blue-100 text-blue-800',
    pro: 'bg-purple-100 text-purple-800',
    multi: 'bg-amber-100 text-amber-800',
    prime: 'bg-green-100 text-green-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{accounts.length}</p>
            <p className="text-xs text-muted-foreground">Total de contas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{legacyCount}</p>
            <p className="text-xs text-muted-foreground">Legado (acesso total)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{withPlan}</p>
            <p className="text-xs text-muted-foreground">Com plano</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{plans.length}</p>
            <p className="text-xs text-muted-foreground">Planos ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" /> Planos Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {plans.map(p => (
              <div key={p.id} className={`rounded-xl border p-4 ${p.slug === 'pro' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-sm">{p.name}</h4>
                  <Badge variant="secondary" className={`text-[10px] ${planColors[p.slug] || ''}`}>
                    {p.slug}
                  </Badge>
                </div>
                <p className="text-lg font-black">R$ {p.price.toFixed(0)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {p.max_users} usuários · {p.max_stores} {p.max_stores === 1 ? 'loja' : 'lojas'} · {(p.features as string[]).length} recursos
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar conta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Accounts list */}
      <div className="space-y-2">
        {filtered.map(account => (
          <Card key={account.id} className="transition-all">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{account.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {account.plan_id ? (
                        <Badge variant="secondary" className={`text-[10px] ${planColors[account.plan_slug || ''] || ''}`}>
                          {account.plan_name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Legado — acesso total</Badge>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={account.plan_id || 'legacy'}
                    onValueChange={(val) => handlePlanChange(account.id, val === 'legacy' ? null : val)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="legacy">Legado (acesso total)</SelectItem>
                      {plans.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — R${p.price.toFixed(0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {saving === account.id && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
