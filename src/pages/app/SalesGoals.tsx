import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Target, Plus, Trash2, Trophy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function SalesGoals() {
  const { currentAccount, stores, user } = useAuth() as any;
  const userRole = (useAuth() as any).userRole as string | null;
  const isManager = userRole && ['owner', 'admin', 'manager'].includes(userRole);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [sellers, setSellers] = useState<any[]>([]);

  useEffect(() => {
    if (!currentAccount) return;
    load();
    if (isManager) loadSellers();

    // Realtime: refetch on any paid sale insertion/update
    const ch = supabase
      .channel(`goals-${currentAccount.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `account_id=eq.${currentAccount.id}` }, () => load())
      .subscribe();

    // Polling fallback every 45s (caso realtime não esteja habilitado p/ a tabela)
    const t = setInterval(load, 45000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount?.id, isManager]);

  const loadSellers = async () => {
    if (!currentAccount) return;
    const { data: memberships } = await supabase
      .from('memberships').select('user_id').eq('account_id', currentAccount.id).in('role', ['seller', 'manager']);
    const ids = (memberships || []).map((m: any) => m.user_id);
    if (!ids.length) { setSellers([]); return; }
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
    setSellers((profiles || []).map((p: any) => ({ user_id: p.user_id, name: p.full_name || 'Sem nome' })));
  };

  const load = async () => {
    if (!currentAccount) return;
    setLoading(true);
    let q = supabase
      .from('sales_goals_progress')
      .select('*')
      .eq('account_id', currentAccount.id)
      .order('period_end', { ascending: false });
    // Sellers só visualizam suas metas (ou metas de loja/conta sem seller específico que os incluam é responsabilidade da gestão; aqui mostramos só as próprias)
    if (!isManager && user?.id) q = q.eq('seller_user_id', user.id);
    const { data } = await q;
    setGoals(data || []); setLoading(false);
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const remove = async (id: string) => {
    if (!confirm('Excluir esta meta?')) return;
    await supabase.from('sales_goals').delete().eq('id', id);
    toast.success('Meta excluída'); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Metas de Vendas</h1>
          <p className="text-sm text-muted-foreground">
            {isManager ? 'Acompanhe metas por loja e por vendedor com bônus.' : 'Acompanhe suas metas e bônus.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
          {isManager && (
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Nova meta</Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : goals.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Target className="h-10 w-10 mx-auto mb-2 opacity-40" />Sem metas cadastradas</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map(g => {
            const target = Number(g.target_amount || 0);
            const achieved = Number(g.achieved_amount || 0);
            const pct = target ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
            const sellerName = sellers?.find((s: any) => s.user_id === g.seller_user_id)?.name;
            const storeName = stores?.find((s: any) => s.id === g.store_id)?.name;
            const finished = pct >= 100;
            return (
              <Card key={g.id} className={finished ? 'border-green-500/40 bg-green-500/5' : ''}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {finished && <Trophy className="h-4 w-4 text-yellow-500" />}
                        {g.scope === 'seller' ? `Vendedor: ${sellerName || (g.seller_user_id === user?.id ? 'Você' : '—')}` : g.scope === 'store' ? `Loja: ${storeName || '—'}` : 'Conta inteira'}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(g.period_start).toLocaleDateString('pt-BR')} → {new Date(g.period_end).toLocaleDateString('pt-BR')}</p>
                    </div>
                    {isManager && (
                      <Button size="icon" variant="ghost" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{fc(achieved)} / {fc(target)}</span>
                      <Badge variant={finished ? 'default' : 'secondary'}>{pct}%</Badge>
                    </div>
                    <Progress value={pct} />
                  </div>
                  {Number(g.bonus_amount) > 0 && (
                    <p className="text-xs text-muted-foreground">Bônus ao bater meta: <span className="font-semibold text-foreground">{fc(g.bonus_amount)}</span></p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isManager && (
        <GoalDialog open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }}
          accountId={currentAccount?.id} stores={stores || []} sellers={sellers || []} />
      )}
    </div>
  );
}

function GoalDialog({ open, onClose, onSaved, accountId, stores, sellers }: any) {
  const [scope, setScope] = useState('store');
  const [storeId, setStoreId] = useState('');
  const [sellerUserId, setSellerUserId] = useState('');
  const [target, setTarget] = useState('');
  const [bonus, setBonus] = useState('');
  const [start, setStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!target) { toast.error('Informe a meta'); return; }
    setBusy(true);
    const { error } = await supabase.from('sales_goals').insert({
      account_id: accountId,
      scope,
      store_id: scope === 'account' ? null : (storeId || null),
      seller_user_id: scope === 'seller' ? (sellerUserId || null) : null,
      target_amount: Number(target),
      bonus_amount: Number(bonus || 0),
      period_start: start, period_end: end,
      active: true,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Meta criada'); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova meta</DialogTitle>
          <DialogDescription>Defina uma meta com período e bônus opcional.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="account">Conta inteira</SelectItem>
                <SelectItem value="store">Por loja</SelectItem>
                <SelectItem value="seller">Por vendedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope !== 'account' && (
            <div>
              <Label>Loja</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {scope === 'seller' && (
            <div>
              <Label>Vendedor</Label>
              <Select value={sellerUserId} onValueChange={setSellerUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {sellers.map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Meta (R$)</Label><Input type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} /></div>
            <div><Label>Bônus (R$)</Label><Input type="number" step="0.01" value={bonus} onChange={e => setBonus(e.target.value)} /></div>
            <div><Label>Início</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
