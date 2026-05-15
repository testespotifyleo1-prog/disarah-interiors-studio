import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Package, ArrowRightLeft } from 'lucide-react';

interface Presentation {
  id: string;
  name: string;
  conversion_factor: number;
  is_purchase: boolean;
  is_sale: boolean;
  price: number | null;
  gtin: string | null;
  is_active: boolean;
  purchase_unit_code: string | null;
}

interface Props {
  productId: string;
  baseUnit: string;
  defaultPrice: number;
}

export default function ProductPresentations({ productId, baseUnit, defaultPrice }: Props) {
  const { toast } = useToast();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New presentation form
  const [newName, setNewName] = useState('');
  const [newFactor, setNewFactor] = useState('');
  const [newIsPurchase, setNewIsPurchase] = useState(false);
  const [newIsSale, setNewIsSale] = useState(true);
  const [newPrice, setNewPrice] = useState('');
  const [newGtin, setNewGtin] = useState('');
  const [newPurchaseUnit, setNewPurchaseUnit] = useState('');

  useEffect(() => {
    loadPresentations();
  }, [productId]);

  const loadPresentations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('product_presentations')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('conversion_factor', { ascending: true });
    setPresentations((data as Presentation[]) || []);
    setLoading(false);
  };

  const addPresentation = async () => {
    if (!newName.trim() || !newFactor || Number(newFactor) <= 0) {
      toast({ variant: 'destructive', title: 'Preencha nome e fator de conversão válido (> 0)' });
      return;
    }
    // Client-side duplicate checks
    const nameExists = presentations.some(p => p.name.toLowerCase() === newName.trim().toLowerCase());
    if (nameExists) {
      toast({ variant: 'destructive', title: 'Já existe uma apresentação com esse nome neste produto' });
      return;
    }
    if (newGtin.trim()) {
      const { data: gtinCheck } = await supabase
        .from('product_presentations')
        .select('id')
        .eq('gtin', newGtin.trim())
        .eq('is_active', true)
        .limit(1);
      if (gtinCheck && gtinCheck.length > 0) {
        toast({ variant: 'destructive', title: 'GTIN já está em uso por outra apresentação' });
        return;
      }
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('product_presentations').insert({
        product_id: productId,
        name: newName.trim(),
        conversion_factor: Number(newFactor),
        is_purchase: newIsPurchase,
        is_sale: newIsSale,
        price: newPrice ? Number(newPrice) : null,
        gtin: newGtin.trim() || null,
        purchase_unit_code: newIsPurchase && newPurchaseUnit.trim() ? newPurchaseUnit.trim().toUpperCase() : null,
      });
      if (error) {
        if (error.message.includes('uq_presentation_name')) throw new Error('Nome duplicado neste produto');
        if (error.message.includes('idx_presentation_gtin_unique')) throw new Error('GTIN já em uso');
        throw error;
      }
      toast({ title: 'Apresentação adicionada!' });
      setNewName(''); setNewFactor(''); setNewPrice(''); setNewGtin(''); setNewPurchaseUnit('');
      setNewIsPurchase(false); setNewIsSale(true);
      loadPresentations();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const removePresentation = async (id: string) => {
    const { error } = await supabase
      .from('product_presentations')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao remover' });
    } else {
      setPresentations(prev => prev.filter(p => p.id !== id));
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
        <Package className="h-4 w-4" />
        <span>
          Configure apresentações para compra e venda fracionada. Unidade base do estoque:{' '}
          <strong className="text-foreground">{baseUnit}</strong>
        </span>
      </div>

      {/* Existing presentations */}
      {presentations.length > 0 && (
        <div className="space-y-2">
          {presentations.map(p => (
            <div key={p.id} className="flex items-center gap-3 border rounded-lg p-3 bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{p.name}</span>
                  <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    = {p.conversion_factor} {baseUnit}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                  {p.is_purchase && <span className="text-blue-600">📦 Compra{p.purchase_unit_code ? ` (${p.purchase_unit_code})` : ''}</span>}
                  {p.is_sale && <span className="text-green-600">🛒 Venda</span>}
                  {p.price != null && <span>Preço: {fc(p.price)}</span>}
                  {p.gtin && <span>GTIN: {p.gtin}</span>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => removePresentation(p.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="border rounded-lg p-4 space-y-3 bg-background">
        <p className="text-xs font-semibold text-muted-foreground">Nova Apresentação</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ex: Caixa com 300"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fator de Conversão *</Label>
            <Input
              type="number"
              value={newFactor}
              onChange={e => setNewFactor(e.target.value)}
              placeholder={`Qtd em ${baseUnit}`}
              className="h-8 text-sm"
              min={0.01}
              step="any"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Preço desta apresentação</Label>
            <Input
              type="number"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              placeholder="Opcional"
              className="h-8 text-sm"
              min={0}
              step={0.01}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">GTIN / Código de Barras</Label>
            <Input
              value={newGtin}
              onChange={e => setNewGtin(e.target.value)}
              placeholder="Opcional"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={newIsPurchase} onCheckedChange={setNewIsPurchase} />
            <Label className="text-xs">Usada na Compra</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={newIsSale} onCheckedChange={setNewIsSale} />
            <Label className="text-xs">Usada na Venda</Label>
          </div>
        </div>
        {newIsPurchase && (
          <div className="space-y-1">
            <Label className="text-xs">Código da Unidade na NF (XML)</Label>
            <Input
              value={newPurchaseUnit}
              onChange={e => setNewPurchaseUnit(e.target.value)}
              placeholder="Ex: CX, PCT, FD, UN"
              className="h-8 text-sm uppercase"
              maxLength={6}
            />
            <p className="text-[10px] text-muted-foreground">
              Informe o código da unidade que aparece no XML da NF-e do fornecedor. Usado para conversão automática na entrada fiscal.
            </p>
          </div>
        )}
        <Button size="sm" onClick={addPresentation} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          Adicionar Apresentação
        </Button>
      </div>

      {/* Help text */}
      <div className="border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">💡 Como funciona o fracionamento?</p>
        <p>
          O estoque é sempre controlado em <strong>{baseUnit}</strong> (unidade base).
        </p>
        <p>
          • Ao lançar uma <strong>entrada de compra</strong> com uma apresentação de compra, o sistema
          multiplica a quantidade pelo fator de conversão e adiciona ao estoque em {baseUnit}.
        </p>
        <p>
          • Ao <strong>vender</strong> uma apresentação de venda, o sistema automaticamente baixa do estoque
          a quantidade correspondente em {baseUnit}.
        </p>
        <p className="text-[10px] mt-1">
          Exemplo: Compra 1 "Caixa com 300" → +300 {baseUnit} no estoque. Vende 1 "Pacote com 25" → -25 {baseUnit} do estoque.
        </p>
      </div>
    </div>
  );
}
