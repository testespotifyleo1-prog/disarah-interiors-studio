import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Settings2 } from 'lucide-react';
import VariantImageGallery from './VariantImageGallery';

interface VariantAttribute {
  name: string;
  value: string;
}

interface ProductVariant {
  id?: string;
  product_id: string;
  sku: string;
  gtin: string;
  price: number;
  cost: number;
  attributes: Record<string, string>;
  is_active: boolean;
}

interface Props {
  productId: string;
  accountId: string;
  defaultPrice: number;
  defaultCost: number;
  variantOptions: string[] | null; // attribute names like ["Cor", "Tamanho"]
  onVariantOptionsChange: (options: string[]) => void;
}

export default function ProductVariants({ productId, accountId, defaultPrice, defaultCost, variantOptions, onVariantOptionsChange }: Props) {
  const { toast } = useToast();
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');
  const [attributeNames, setAttributeNames] = useState<string[]>(variantOptions || []);

  useEffect(() => {
    loadVariants();
  }, [productId]);

  useEffect(() => {
    setAttributeNames(variantOptions || []);
  }, [variantOptions]);

  const loadVariants = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('created_at');
    setVariants((data || []).map((v: any) => ({
      id: v.id,
      product_id: v.product_id,
      sku: v.sku || '',
      gtin: v.gtin || '',
      price: v.price,
      cost: v.cost,
      attributes: v.attributes || {},
      is_active: v.is_active,
    })));
    setLoading(false);
  };

  const addAttribute = () => {
    const name = newAttrName.trim();
    if (!name || attributeNames.includes(name)) return;
    const updated = [...attributeNames, name];
    setAttributeNames(updated);
    onVariantOptionsChange(updated);
    setNewAttrName('');
  };

  const removeAttribute = (name: string) => {
    const updated = attributeNames.filter(a => a !== name);
    setAttributeNames(updated);
    onVariantOptionsChange(updated);
    // Remove this attribute from all variants
    setVariants(prev => prev.map(v => {
      const attrs = { ...v.attributes };
      delete attrs[name];
      return { ...v, attributes: attrs };
    }));
  };

  const addVariant = () => {
    const attrs: Record<string, string> = {};
    attributeNames.forEach(a => attrs[a] = '');
    setVariants(prev => [...prev, {
      product_id: productId,
      sku: '',
      gtin: '',
      price: defaultPrice,
      cost: defaultCost,
      attributes: attrs,
      is_active: true,
    }]);
  };

  const updateVariant = (index: number, field: string, value: any) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const updateVariantAttr = (index: number, attrName: string, value: string) => {
    setVariants(prev => prev.map((v, i) => i === index
      ? { ...v, attributes: { ...v.attributes, [attrName]: value } }
      : v
    ));
  };

  const removeVariant = async (index: number) => {
    const variant = variants[index];
    if (variant.id) {
      const { error } = await supabase.from('product_variants').delete().eq('id', variant.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Erro ao excluir variação', description: error.message });
        return;
      }
    }
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const v of variants) {
        // Validate: at least one attribute filled
        const hasAttrs = Object.values(v.attributes).some(val => val.trim());
        if (!hasAttrs && attributeNames.length > 0) continue;

        const payload = {
          product_id: productId,
          sku: v.sku || null,
          gtin: v.gtin || null,
          price: v.price,
          cost: v.cost,
          attributes: v.attributes,
          is_active: v.is_active,
        };

        if (v.id) {
          const { error } = await supabase.from('product_variants').update(payload).eq('id', v.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('product_variants').insert(payload).select('id').single();
          if (error) throw error;
          v.id = data.id;
        }
      }
      toast({ title: 'Variações salvas!' });
      loadVariants();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Defina atributos (ex: Cor, Tamanho, Voltagem) e crie variações com preço e estoque independentes.
      </p>

      {/* Attribute definitions */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Atributos de Variação</Label>
        <div className="flex flex-wrap gap-2">
          {attributeNames.map(attr => (
            <Badge key={attr} variant="secondary" className="gap-1 text-xs">
              {attr}
              <button onClick={() => removeAttribute(attr)} className="ml-1 hover:text-destructive">×</button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newAttrName}
            onChange={e => setNewAttrName(e.target.value)}
            placeholder="Ex: Cor, Tamanho, Voltagem..."
            className="h-8 text-xs flex-1"
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAttribute())}
          />
          <Button type="button" size="sm" variant="outline" onClick={addAttribute} className="h-8 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Variant list */}
      {attributeNames.length > 0 && (
        <>
          <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
            {variants.length === 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                Nenhuma variação cadastrada. Clique em "Nova Variação" para criar.
              </div>
            )}
            {variants.map((v, i) => (
              <div key={v.id || `new-${i}`} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Variação {i + 1}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeVariant(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {/* Attributes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attributeNames.map(attr => (
                    <div key={attr} className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{attr}</Label>
                      <Input
                        value={v.attributes[attr] || ''}
                        onChange={e => updateVariantAttr(i, attr, e.target.value)}
                        className="h-7 text-xs"
                        placeholder={attr}
                      />
                    </div>
                  ))}
                </div>
                {/* Price/SKU row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">SKU</Label>
                    <Input value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">GTIN</Label>
                    <Input value={v.gtin} onChange={e => updateVariant(i, 'gtin', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Preço</Label>
                    <Input type="number" value={v.price} onChange={e => updateVariant(i, 'price', Number(e.target.value))} className="h-7 text-xs" min={0} step={0.01} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Custo</Label>
                    <Input type="number" value={v.cost} onChange={e => updateVariant(i, 'cost', Number(e.target.value))} className="h-7 text-xs" min={0} step={0.01} />
                  </div>
                </div>
                {/* Image gallery (only for saved variants) */}
                {v.id && accountId && (
                  <div className="pt-2 border-t">
                    <VariantImageGallery variantId={v.id} accountId={accountId} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addVariant} className="text-xs">
              <Plus className="h-3 w-3 mr-1" /> Nova Variação
            </Button>
            <Button type="button" size="sm" onClick={saveAll} disabled={saving} className="text-xs">
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Salvar Variações
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
