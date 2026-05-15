import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, DollarSign } from 'lucide-react';

interface PriceTier {
  id: string;
  label: string;
  min_qty: number;
  unit_price: number;
  is_active: boolean;
}

interface Props {
  productId: string;
  defaultPrice: number;
}

export default function ProductPriceTiers({ productId, defaultPrice }: Props) {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newLabel, setNewLabel] = useState('Atacado');
  const [newMinQty, setNewMinQty] = useState('');
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => { loadTiers(); }, [productId]);

  const loadTiers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('product_price_tiers')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('min_qty', { ascending: true });
    setTiers((data as PriceTier[]) || []);
    setLoading(false);
  };

  const addTier = async () => {
    if (!newLabel.trim() || !newMinQty || Number(newMinQty) < 2 || !newPrice || Number(newPrice) <= 0) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos. Quantidade mínima deve ser ≥ 2.' });
      return;
    }
    const minQty = Number(newMinQty);
    const exists = tiers.some(t => t.min_qty === minQty);
    if (exists) {
      toast({ variant: 'destructive', title: 'Já existe uma faixa com essa quantidade mínima' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('product_price_tiers').insert({
        product_id: productId,
        label: newLabel.trim(),
        min_qty: minQty,
        unit_price: Number(newPrice),
      });
      if (error) throw error;
      toast({ title: 'Faixa de preço adicionada!' });
      setNewLabel('Atacado');
      setNewMinQty('');
      setNewPrice('');
      loadTiers();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  const removeTier = async (id: string) => {
    const { error } = await supabase
      .from('product_price_tiers')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao remover' });
    } else {
      setTiers(prev => prev.filter(t => t.id !== id));
    }
  };

  const fc = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <DollarSign className="h-4 w-4" />
        <span>
          Configure faixas de preço por quantidade (ex: atacado e varejo). O preço base (varejo) é{' '}
          <strong className="text-foreground">{fc(defaultPrice)}</strong>
        </span>
      </div>

      {tiers.length > 0 && (
        <div className="space-y-2">
          {tiers.map(t => (
            <div key={t.id} className="flex items-center gap-3 border rounded-lg p-3 bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{t.label}</span>
                  <span className="text-xs text-muted-foreground">
                    a partir de <strong>{t.min_qty}</strong> un.
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Preço unitário: <strong className="text-foreground">{fc(t.unit_price)}</strong>
                  {defaultPrice > 0 && (
                    <span className="ml-2 text-green-600">
                      ({Math.round((1 - t.unit_price / defaultPrice) * 100)}% desc.)
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => removeTier(t.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-lg p-4 space-y-3 bg-background">
        <p className="text-xs font-semibold text-muted-foreground">Nova Faixa de Preço</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome da Faixa *</Label>
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Ex: Atacado"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Qtd Mínima *</Label>
            <Input
              type="number"
              value={newMinQty}
              onChange={e => setNewMinQty(e.target.value)}
              placeholder="Ex: 10"
              className="h-8 text-sm"
              min={2}
              step={1}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preço Unitário *</Label>
            <Input
              type="number"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              placeholder="0.00"
              className="h-8 text-sm"
              min={0.01}
              step={0.01}
            />
          </div>
        </div>
        <Button size="sm" onClick={addTier} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          Adicionar Faixa
        </Button>
      </div>

      <div className="border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">💡 Como funciona o preço por faixa?</p>
        <p>
          O preço base (varejo) é aplicado automaticamente para quantidades menores.
        </p>
        <p>
          • Quando o vendedor adicionar <strong>10 ou mais</strong> unidades no PDV, o sistema
          automaticamente troca o preço unitário para o valor da faixa "Atacado".
        </p>
        <p>
          • Se a quantidade voltar abaixo do mínimo, o preço retorna ao valor de varejo.
        </p>
        <p className="text-[10px] mt-1">
          Exemplo: Varejo = R$ 5,00 | Atacado (≥10) = R$ 3,50 → Ao adicionar 10 un., preço muda para R$ 3,50/un.
        </p>
      </div>
    </div>
  );
}
