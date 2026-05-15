import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/utils/activityLog';

interface Props {
  open: boolean;
  onClose: () => void;
  category: string;
  productCount: number;
  allCategories: string[];
  onDone: () => void;
}

type Action = 'price' | 'promo' | 'toggle' | 'move';

export default function BulkActionsModal({ open, onClose, category, productCount, allCategories, onDone }: Props) {
  const { currentAccount, user } = useAuth();
  const { toast } = useToast();
  const [action, setAction] = useState<Action>('price');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // price
  const [priceMode, setPriceMode] = useState<'percent' | 'fixed'>('percent');
  const [priceDirection, setPriceDirection] = useState<'up' | 'down'>('up');
  const [priceValue, setPriceValue] = useState('');
  const [pin, setPin] = useState('');

  // promo
  const [promoMode, setPromoMode] = useState<'percent' | 'price'>('percent');
  const [promoValue, setPromoValue] = useState('');
  const [promoStart, setPromoStart] = useState('');
  const [promoEnd, setPromoEnd] = useState('');
  const [removePromo, setRemovePromo] = useState(false);

  // toggle
  const [toggleActive, setToggleActive] = useState(true);

  // move
  const [newCategory, setNewCategory] = useState('');

  const reset = () => {
    setAction('price'); setBusy(false); setConfirmed(false);
    setPriceValue(''); setPin('');
    setPromoValue(''); setPromoStart(''); setPromoEnd(''); setRemovePromo(false);
    setNewCategory('');
  };
  const close = () => { reset(); onClose(); };

  const needsPin = action === 'price' && Number(priceValue) > 20 && priceMode === 'percent';

  const apply = async () => {
    if (!currentAccount) return;
    setBusy(true);
    try {
      // Verify PIN if needed
      if (needsPin) {
        const { data: acc } = await supabase.from('accounts').select('owner_pin').eq('id', currentAccount.id).maybeSingle();
        if (!acc?.owner_pin || acc.owner_pin !== pin) {
          toast({ variant: 'destructive', title: 'PIN incorreto' });
          setBusy(false); return;
        }
      }

      // Fetch products of category (with pagination to handle >1000)
      let products: { id: string; price_default: number }[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('products')
          .select('id, price_default')
          .eq('account_id', currentAccount.id)
          .eq('category', category)
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        products = products.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }

      if (action === 'price') {
        const v = Number(priceValue);
        if (!v || v <= 0) throw new Error('Informe um valor válido');
        const sign = priceDirection === 'up' ? 1 : -1;
        for (const p of products) {
          const newPrice = priceMode === 'percent'
            ? Math.max(0, p.price_default * (1 + sign * v / 100))
            : Math.max(0, p.price_default + sign * v);
          await supabase.from('products').update({ price_default: Math.round(newPrice * 100) / 100 }).eq('id', p.id);
        }
        await logActivity({ accountId: currentAccount.id, userId: user?.id || '', userName: user?.email || '', action: 'bulk_price_adjust', entityType: 'category', entityId: category, details: { count: products.length, mode: priceMode, value: v, direction: priceDirection } });
      }
      else if (action === 'promo') {
        if (removePromo) {
          await supabase.from('products').update({ promo_price: null, promo_starts_at: null, promo_ends_at: null })
            .eq('account_id', currentAccount.id).eq('category', category);
        } else {
          const v = Number(promoValue);
          if (!v || v <= 0) throw new Error('Informe valor da promoção');
          for (const p of products) {
            const promoPrice = promoMode === 'percent'
              ? Math.max(0, p.price_default * (1 - v / 100))
              : v;
            await supabase.from('products').update({
              promo_price: Math.round(promoPrice * 100) / 100,
              promo_starts_at: promoStart || null,
              promo_ends_at: promoEnd || null,
            }).eq('id', p.id);
          }
        }
        await logActivity({ accountId: currentAccount.id, userId: user?.id || '', userName: user?.email || '', action: 'bulk_promo', entityType: 'category', entityId: category, details: { count: products.length, removed: removePromo, mode: promoMode, value: promoValue } });
      }
      else if (action === 'toggle') {
        await supabase.from('products').update({ is_active: toggleActive })
          .eq('account_id', currentAccount.id).eq('category', category);
        await logActivity({ accountId: currentAccount.id, userId: user?.id || '', userName: user?.email || '', action: 'bulk_toggle', entityType: 'category', entityId: category, details: { count: products.length, is_active: toggleActive } });
      }
      else if (action === 'move') {
        if (!newCategory.trim()) throw new Error('Informe a nova categoria');
        await supabase.from('products').update({ category: newCategory.trim() })
          .eq('account_id', currentAccount.id).eq('category', category);
        await logActivity({ accountId: currentAccount.id, userId: user?.id || '', userName: user?.email || '', action: 'bulk_move_category', entityType: 'category', entityId: category, details: { count: products.length, from: category, to: newCategory.trim() } });
      }

      toast({ title: '✅ Ação aplicada com sucesso!', description: `${products.length} produto(s) atualizado(s)` });
      onDone();
      close();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={open => !open && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ações em massa — {category}</DialogTitle>
          <DialogDescription>{productCount} produto(s) serão afetados</DialogDescription>
        </DialogHeader>

        <Tabs value={action} onValueChange={v => setAction(v as Action)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="price">Preço</TabsTrigger>
            <TabsTrigger value="promo">Promoção</TabsTrigger>
            <TabsTrigger value="toggle">Ativar</TabsTrigger>
            <TabsTrigger value="move">Mover</TabsTrigger>
          </TabsList>

          <TabsContent value="price" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <RadioGroup value={priceDirection} onValueChange={v => setPriceDirection(v as any)} className="grid grid-cols-2 gap-2 col-span-2">
                <label className="flex items-center gap-2 border rounded p-2 cursor-pointer"><RadioGroupItem value="up" /> Aumentar</label>
                <label className="flex items-center gap-2 border rounded p-2 cursor-pointer"><RadioGroupItem value="down" /> Diminuir</label>
              </RadioGroup>
              <RadioGroup value={priceMode} onValueChange={v => setPriceMode(v as any)} className="grid grid-cols-2 gap-2 col-span-2">
                <label className="flex items-center gap-2 border rounded p-2 cursor-pointer"><RadioGroupItem value="percent" /> Porcentagem (%)</label>
                <label className="flex items-center gap-2 border rounded p-2 cursor-pointer"><RadioGroupItem value="fixed" /> Valor fixo (R$)</label>
              </RadioGroup>
            </div>
            <div>
              <Label>Valor {priceMode === 'percent' ? '(%)' : '(R$)'}</Label>
              <Input type="number" value={priceValue} onChange={e => setPriceValue(e.target.value)} placeholder={priceMode === 'percent' ? 'Ex: 10' : 'Ex: 50.00'} />
            </div>
            {needsPin && (
              <div>
                <Label>PIN do dono (necessário para reajustes &gt; 20%)</Label>
                <Input type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={6} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="promo" className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <Switch checked={removePromo} onCheckedChange={setRemovePromo} />
              <Label>Remover promoção atual</Label>
            </div>
            {!removePromo && <>
              <RadioGroup value={promoMode} onValueChange={v => setPromoMode(v as any)} className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 border rounded p-2 cursor-pointer"><RadioGroupItem value="percent" /> Desconto (%)</label>
                <label className="flex items-center gap-2 border rounded p-2 cursor-pointer"><RadioGroupItem value="price" /> Preço promocional fixo</label>
              </RadioGroup>
              <div>
                <Label>{promoMode === 'percent' ? 'Desconto (%)' : 'Preço (R$)'}</Label>
                <Input type="number" value={promoValue} onChange={e => setPromoValue(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início</Label><Input type="date" value={promoStart} onChange={e => setPromoStart(e.target.value)} /></div>
                <div><Label>Fim</Label><Input type="date" value={promoEnd} onChange={e => setPromoEnd(e.target.value)} /></div>
              </div>
            </>}
          </TabsContent>

          <TabsContent value="toggle" className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <Switch checked={toggleActive} onCheckedChange={setToggleActive} />
              <Label>{toggleActive ? 'Ativar todos' : 'Desativar todos'}</Label>
            </div>
          </TabsContent>

          <TabsContent value="move" className="space-y-3 pt-3">
            <div>
              <Label>Nova categoria</Label>
              <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Ex: Sofás" list="cats" />
              <datalist id="cats">
                {allCategories.filter(c => c !== category).map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </TabsContent>
        </Tabs>

        {!confirmed ? (
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancelar</Button>
            <Button onClick={() => setConfirmed(true)}>Revisar</Button>
          </DialogFooter>
        ) : (
          <div className="space-y-2">
            <div className="bg-muted border border-border rounded p-3 text-sm">
              ⚠️ Esta ação afetará <strong>{productCount} produto(s)</strong> da categoria <strong>{category}</strong>. Deseja confirmar?
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmed(false)} disabled={busy}>Voltar</Button>
              <Button onClick={apply} disabled={busy}>
                {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Confirmar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
