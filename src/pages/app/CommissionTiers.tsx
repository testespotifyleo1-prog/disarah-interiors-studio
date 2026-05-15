import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, TrendingUp, Percent } from 'lucide-react';

interface Tier {
  id: string;
  account_id: string;
  seller_id: string;
  tier_type: string;
  min_value: number;
  max_value: number | null;
  percent: number;
  is_active: boolean;
}

interface SellerInfo {
  user_id: string;
  full_name: string;
}

export default function CommissionTiers() {
  const { currentAccount } = useAuth();
  const { toast } = useToast();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [sellers, setSellers] = useState<SellerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedSeller, setSelectedSeller] = useState('');
  const [tierType, setTierType] = useState('per_sale');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [percent, setPercent] = useState('');

  useEffect(() => { if (currentAccount) loadData(); }, [currentAccount]);

  const loadData = async () => {
    if (!currentAccount) return;
    setLoading(true);

    const [{ data: tiersData }, { data: memberships }] = await Promise.all([
      supabase.from('commission_tiers').select('*').eq('account_id', currentAccount.id).eq('is_active', true).order('seller_id').order('min_value'),
      supabase.from('memberships').select('user_id').eq('account_id', currentAccount.id).eq('role', 'seller').eq('is_active', true),
    ]);

    setTiers((tiersData || []) as Tier[]);

    if (memberships && memberships.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', memberships.map(m => m.user_id));
      setSellers((profiles || []).map(p => ({ user_id: p.user_id, full_name: p.full_name || 'Sem nome' })));
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!currentAccount || !selectedSeller || !percent) return;
    setSaving(true);
    const { error } = await supabase.from('commission_tiers').insert({
      account_id: currentAccount.id,
      seller_id: selectedSeller,
      tier_type: tierType,
      min_value: parseFloat(minValue) || 0,
      max_value: maxValue ? parseFloat(maxValue) : null,
      percent: parseFloat(percent) || 0,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Faixa adicionada!' });
      setDialogOpen(false);
      setMinValue(''); setMaxValue(''); setPercent('');
      loadData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta faixa de comissão? Vendas futuras voltarão a usar o percentual fixo do vendedor.')) return;
    await supabase.from('commission_tiers').update({ is_active: false }).eq('id', id);
    toast({ title: 'Faixa removida' });
    loadData();
  };

  const fc = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const getSellerName = (uid: string) => sellers.find(s => s.user_id === uid)?.full_name || uid.slice(0, 8);

  // Group by seller
  const grouped = tiers.reduce((acc, t) => {
    if (!acc[t.seller_id]) acc[t.seller_id] = [];
    acc[t.seller_id].push(t);
    return acc;
  }, {} as Record<string, Tier[]>);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6" /> Faixas de Comissão</h1>
          <p className="text-muted-foreground">Configure comissões escalonadas por vendedor</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova Faixa</Button>
      </div>

      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Como funciona:</strong> Configure faixas de valor para cada vendedor. Na hora da venda, o sistema calcula a comissão automaticamente:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 list-disc pl-5 space-y-1">
            <li><strong>Por venda:</strong> Percentual baseado no valor total de cada venda individual</li>
            <li><strong>Acumulado mensal:</strong> Percentual baseado no total acumulado de vendas do vendedor no mês</li>
          </ul>
        </CardContent>
      </Card>

      {Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma faixa configurada. Use a comissão fixa padrão ou adicione faixas.</CardContent></Card>
      ) : (
        Object.entries(grouped).map(([sellerId, sellerTiers]) => (
          <Card key={sellerId}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4" /> {getSellerName(sellerId)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sellerTiers.map(tier => (
                  <div key={tier.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {tier.tier_type === 'per_sale' ? 'Por Venda' : 'Acumulado Mensal'}
                      </Badge>
                      <span className="text-sm">
                        {fc(tier.min_value)} {tier.max_value ? `até ${fc(tier.max_value)}` : 'em diante'}
                      </span>
                      <Badge className="bg-green-500 text-white">{tier.percent}%</Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(tier.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Faixa de Comissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sellers.map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tierType} onValueChange={setTierType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_sale">Por Venda Individual</SelectItem>
                  <SelectItem value="monthly_accumulated">Acumulado Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valor mínimo (R$)</Label>
                <Input type="number" value={minValue} onChange={e => setMinValue(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Valor máximo (R$)</Label>
                <Input type="number" value={maxValue} onChange={e => setMaxValue(e.target.value)} placeholder="Sem limite" />
              </div>
              <div className="space-y-2">
                <Label>Comissão (%)</Label>
                <Input type="number" value={percent} onChange={e => setPercent(e.target.value)} placeholder="5" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving || !selectedSeller || !percent}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
