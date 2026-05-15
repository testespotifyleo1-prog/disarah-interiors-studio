import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Store, ArrowRight, Sofa, PartyPopper, Package, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BusinessType } from '@/types/database';

type BusinessOption = {
  value: BusinessType;
  label: string;
  icon: typeof Sofa;
  examples: string;
};

const BUSINESS_OPTIONS: BusinessOption[] = [
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

export default function Onboarding() {
  const { user, loading, currentAccount, dataLoaded } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [accountName, setAccountName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('furniture');
  const [storeName, setStoreName] = useState('');
  const [storeCnpj, setStoreCnpj] = useState('');

  if (loading || (user && !dataLoaded)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (currentAccount) return <Navigate to="/app/dashboard" replace />;

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  const handleStep1 = () => {
    if (!accountName.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Informe o nome da empresa' });
      return;
    }
    setStep(2);
  };

  const handleStep2 = () => {
    setStep(3);
  };

  const handleCreateStore = async () => {
    if (!storeName.trim() || !storeCnpj.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos' });
      return;
    }

    const cnpjNumbers = storeCnpj.replace(/\D/g, '');
    if (cnpjNumbers.length !== 14) {
      toast({ variant: 'destructive', title: 'Erro', description: 'CNPJ inválido' });
      return;
    }

    setIsSubmitting(true);

    try {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert({
          name: accountName.trim(),
          owner_user_id: user.id,
          trial_ends_at: trialEndsAt.toISOString(),
          plan_status: 'trial',
          business_type: businessType,
        } as any)
        .select()
        .single();

      if (accountError) throw accountError;

      const { error: storeError } = await supabase
        .from('stores')
        .insert({
          account_id: account.id,
          name: storeName.trim(),
          cnpj: cnpjNumbers,
        });

      if (storeError) throw storeError;

      toast({ title: 'Conta criada com sucesso!', description: 'Redirecionando...' });
      setTimeout(() => { window.location.href = '/app/dashboard'; }, 1000);
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast({ variant: 'destructive', title: 'Erro ao criar conta', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            {step === 1 && <Building2 className="h-8 w-8 text-primary-foreground" />}
            {step === 2 && <Sofa className="h-8 w-8 text-primary-foreground" />}
            {step === 3 && <Store className="h-8 w-8 text-primary-foreground" />}
          </div>
          <CardTitle className="text-2xl">
            {step === 1 && 'Criar Empresa'}
            {step === 2 && 'Tipo de Negócio'}
            {step === 3 && 'Criar Loja'}
          </CardTitle>
          <CardDescription>
            {step === 1 && 'Passo 1 de 3 — Configure sua empresa'}
            {step === 2 && 'Passo 2 de 3 — Escolha o segmento da sua loja'}
            {step === 3 && 'Passo 3 de 3 — Adicione sua primeira loja'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="account-name">Nome da Empresa</Label>
                <Input
                  id="account-name"
                  type="text"
                  placeholder="Ex: Minha Empresa Ltda"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  autoFocus
                />
              </div>
              <Button onClick={handleStep1} className="w-full">
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center mb-2">
                Você poderá alterar isso depois em Configurações.
              </p>
              {BUSINESS_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = businessType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBusinessType(opt.value)}
                    className={cn(
                      'w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40 hover:bg-accent/30'
                    )}
                  >
                    <div className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70'
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{opt.label}</span>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 italic">Ex: {opt.examples}</p>
                    </div>
                  </button>
                );
              })}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button onClick={handleStep2} className="flex-1">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="store-name">Nome da Loja</Label>
                <Input
                  id="store-name"
                  type="text"
                  placeholder="Ex: Loja Centro"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-cnpj">CNPJ</Label>
                <Input
                  id="store-cnpj"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={storeCnpj}
                  onChange={(e) => setStoreCnpj(formatCnpj(e.target.value))}
                  maxLength={18}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={isSubmitting}>
                  Voltar
                </Button>
                <Button onClick={handleCreateStore} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar e Começar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
