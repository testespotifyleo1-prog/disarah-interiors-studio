import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sofa, PartyPopper, Package, Check, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BusinessType } from '@/types/database';

type Option = {
  value: BusinessType;
  label: string;
  icon: typeof Sofa;
  examples: string;
};

const OPTIONS: Option[] = [
  {
    value: 'furniture',
    label: 'Loja de Móveis',
    icon: Sofa,
    examples: 'Móveis planejados, sofás, camas, decoração.',
  },
  {
    value: 'party',
    label: 'Loja de Festas',
    icon: PartyPopper,
    examples: 'Artigos para festas, descartáveis, decoração.',
  },
  {
    value: 'general',
    label: 'Outros / Geral',
    icon: Package,
    examples: 'Roupas, mercado, materiais, eletrônicos, etc.',
  },
];

export default function BusinessTypeSettings() {
  const { currentAccount, userRole } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<BusinessType>('furniture');
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<BusinessType>('furniture');

  useEffect(() => {
    const current = (currentAccount?.business_type as BusinessType) || 'furniture';
    setSelected(current);
    setOriginal(current);
  }, [currentAccount]);

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';
  const dirty = selected !== original;

  const handleSave = async () => {
    if (!currentAccount?.id || !dirty) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ business_type: selected } as any)
        .eq('id', currentAccount.id);
      if (error) throw error;
      toast({
        title: 'Tipo de negócio atualizado!',
        description: 'A interface será atualizada em instantes.',
      });
      setOriginal(selected);
      // Reload to refresh AuthContext with the new business_type
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (!isOwnerOrAdmin) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Apenas o proprietário ou administrador pode alterar o tipo de negócio.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tipo de Negócio</h1>
        <p className="text-sm text-muted-foreground">
          Selecione o segmento da sua loja.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 flex gap-2 items-start">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Você pode alterar o tipo de negócio a qualquer momento.
        </p>
      </div>

      <div className="grid gap-3">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={cn(
                'w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40 hover:bg-accent/30'
              )}
            >
              <div className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70'
              )}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{opt.label}</span>
                  {original === opt.value && (
                    <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Atual
                    </span>
                  )}
                  {isSelected && <Check className="h-4 w-4 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1 italic">Ex: {opt.examples}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={!dirty || saving} size="lg">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {dirty ? 'Salvar alteração' : 'Sem alterações'}
        </Button>
      </div>
    </div>
  );
}
