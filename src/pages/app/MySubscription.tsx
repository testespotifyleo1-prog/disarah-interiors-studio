import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/contexts/PlanContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, Crown, AlertTriangle, Clock, ArrowUpRight, 
  Sparkles, Shield, Calendar, CreditCard 
} from 'lucide-react';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { PixManualPayment } from '@/components/payment/PixManualPayment';
import { Progress } from '@/components/ui/progress';

const PLAN_PRICE_MAP: Record<string, { priceId: string; name: string; price: number; yearlyPix: number; features: string[] }> = {
  start: {
    priceId: 'start_monthly',
    name: 'Typos Start',
    price: 199,
    yearlyPix: 2029,
    features: ['PDV completo + PDV Rápido', 'Produtos, categorias e variantes', 'Controle de estoque', 'Clientes e fornecedores', 'Vendas e caixa', 'Financeiro básico', 'Crediário básico', 'Fiscal básico (NFC-e)', 'Relatórios principais'],
  },
  pro: {
    priceId: 'pro_monthly',
    name: 'Typos Pro',
    price: 349,
    yearlyPix: 3559,
    features: ['Tudo do Start', 'Orçamentos e pré-venda', 'Pedidos de compra', 'Sugestão de reposição', 'Transferência entre lojas', 'Comissões', 'Devoluções', 'Entradas fiscais', 'Importação em massa', 'Etiquetas'],
  },
  multi: {
    priceId: 'multi_monthly',
    name: 'Typos Multi',
    price: 597,
    yearlyPix: 6089,
    features: ['Tudo do Pro', 'Multi-loja robusto', 'Gestão operacional entre lojas', 'Fluxo avançado de transferências', 'Suporte prioritário'],
  },
  prime: {
    priceId: 'prime_monthly',
    name: 'Typos Prime',
    price: 897,
    yearlyPix: 9150,
    features: ['Tudo do Multi', 'WhatsApp com chatbot IA', 'Loja online (e-commerce)', 'Logística e entregas', 'Montagens', 'Suporte máximo'],
  },
};

const PLAN_ORDER = ['start', 'pro', 'multi', 'prime'];

type PaymentChoice = 'card_monthly' | 'pix_monthly' | 'pix_yearly';

function getPriceId(slug: string, choice: PaymentChoice): string {
  if (choice === 'card_monthly') return `${slug}_monthly`;
  if (choice === 'pix_monthly') return `${slug}_pix_monthly`;
  return `${slug}_pix_yearly`;
}

export default function MySubscription() {
  const { user, currentAccount } = useAuth();
  const { plan, planLoading, allPlans, isLegacyAccount, isTrialExpired, trialDaysLeft, planStatus } = usePlan();
  const [upgradePlan, setUpgradePlan] = useState<string | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('card_monthly');
  const [showCheckout, setShowCheckout] = useState(false);

  const accountAny = currentAccount as any;
  const trialEndsAt = accountAny?.trial_ends_at ? new Date(accountAny.trial_ends_at) : null;

  // Determine current plan slug
  const currentPlanSlug = plan?.slug || null;
  const currentPlanIndex = currentPlanSlug ? PLAN_ORDER.indexOf(currentPlanSlug) : -1;

  // Available upgrades
  const availableUpgrades = PLAN_ORDER
    .filter((_, i) => i > currentPlanIndex)
    .map(key => ({ key, ...PLAN_PRICE_MAP[key] }));

  if (showCheckout && upgradePlan) {
    const planInfo = PLAN_PRICE_MAP[upgradePlan];
    const isPix = paymentChoice !== 'card_monthly';
    const amount = paymentChoice === 'pix_yearly' ? planInfo.yearlyPix : planInfo.price;
    const label = paymentChoice === 'card_monthly' ? 'cartão / mês' : paymentChoice === 'pix_monthly' ? 'PIX / 30 dias' : 'PIX / 365 dias';
    const planDb = allPlans.find(p => p.slug === upgradePlan);
    return (
      <div className="space-y-6">
        <PaymentTestModeBanner />
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => setShowCheckout(false)} className="mb-4 gap-2">
            ← Voltar
          </Button>
          <h1 className="text-2xl font-bold mb-2">Assinar {planInfo.name}</h1>
          <p className="text-muted-foreground mb-6">R$ {amount} — {label}</p>
          {isPix && planDb ? (
            <PixManualPayment
              planId={planDb.id}
              planName={planInfo.name}
              amount={amount}
              billingCycle={paymentChoice === 'pix_yearly' ? 'yearly' : 'monthly'}
              onCancel={() => setShowCheckout(false)}
            />
          ) : (
            <StripeEmbeddedCheckout
              priceId={`${upgradePlan}_monthly`}
              customerEmail={user?.email}
              userId={user?.id}
              accountId={currentAccount?.id}
              paymentMethod="card"
              returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </div>
      </div>
    );
  }

  const getStatusBadge = () => {
    if (isLegacyAccount) {
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"><Shield className="h-3 w-3" /> Acesso Completo</Badge>;
    }
    if (isTrialExpired) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Teste Expirado</Badge>;
    }
    if (planStatus === 'trial') {
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1"><Clock className="h-3 w-3" /> Período de Teste</Badge>;
    }
    if (planStatus === 'active') {
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"><CheckCircle2 className="h-3 w-3" /> Ativo</Badge>;
    }
    if (planStatus === 'canceled') {
      return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> Cancelado</Badge>;
    }
    return <Badge variant="outline">Sem plano</Badge>;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minha Assinatura</h1>
        <p className="text-muted-foreground text-sm">Gerencie seu plano e assinatura</p>
      </div>

      {/* Current Plan Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-0">
          <CardHeader className="p-0 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    {isLegacyAccount ? 'Plano Legado' : plan ? plan.name : 'Sem plano ativo'}
                  </CardTitle>
                  <CardDescription>
                    {isLegacyAccount 
                      ? 'Conta com acesso completo a todos os recursos' 
                      : plan 
                        ? `R$ ${plan.price}/mês`
                        : 'Selecione um plano para começar'
                    }
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
        </div>
        
        <CardContent className="pt-4 space-y-4">
          {/* Trial Info */}
          {planStatus === 'trial' && trialEndsAt && (
            <div className={`rounded-xl p-4 ${isTrialExpired ? 'bg-destructive/5 border border-destructive/20' : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'}`}>
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isTrialExpired ? 'bg-destructive/10' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                  {isTrialExpired 
                    ? <AlertTriangle className="h-5 w-5 text-destructive" />
                    : <Clock className="h-5 w-5 text-amber-600" />
                  }
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">
                    {isTrialExpired ? 'Seu teste gratuito expirou' : 'Teste gratuito em andamento'}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isTrialExpired 
                      ? 'Assine um plano para continuar usando todos os recursos do Typos.'
                      : `Seu teste termina em ${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''} (${trialEndsAt.toLocaleDateString('pt-BR')})`
                    }
                  </p>
                  {!isTrialExpired && trialDaysLeft !== null && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progresso do teste</span>
                        <span>{Math.max(0, 7 - trialDaysLeft)} de 7 dias</span>
                      </div>
                      <Progress value={Math.min(100, ((7 - trialDaysLeft) / 7) * 100)} className="h-2" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Plan Details */}
          {plan && !isLegacyAccount && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border p-4 text-center">
                <Calendar className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Plano</p>
                <p className="font-semibold text-sm">{plan.name}</p>
              </div>
              <div className="rounded-xl border p-4 text-center">
                <CreditCard className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Valor mensal</p>
                <p className="font-semibold text-sm">R$ {plan.price}</p>
              </div>
              <div className="rounded-xl border p-4 text-center">
                <Shield className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Limites</p>
                <p className="font-semibold text-sm">{plan.max_stores} loja{plan.max_stores > 1 ? 's' : ''} · {plan.max_users} usuário{plan.max_users > 1 ? 's' : ''}</p>
              </div>
            </div>
          )}

          {/* Current plan features */}
          {plan && !isLegacyAccount && currentPlanSlug && PLAN_PRICE_MAP[currentPlanSlug] && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Recursos inclusos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {PLAN_PRICE_MAP[currentPlanSlug].features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Section */}
      {!isLegacyAccount && availableUpgrades.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              {plan ? 'Fazer Upgrade' : 'Escolher um Plano'}
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableUpgrades.map(({ key, name, price, yearlyPix, features }) => {
              const isPopular = key === 'pro';
              return (
                <Card key={key} className={`relative overflow-hidden transition-shadow hover:shadow-lg ${isPopular ? 'border-2 border-primary shadow-md shadow-primary/10' : ''}`}>
                  {isPopular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-[10px] font-bold uppercase rounded-bl-lg">
                      Mais popular
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{name}</CardTitle>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-foreground">R$ {price}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    <p className="text-xs text-muted-foreground">ou R$ {yearlyPix} anual no PIX</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-1.5 text-sm">
                      {features.slice(0, 5).map(f => (
                        <li key={f} className="flex items-start gap-2 text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> {f}
                        </li>
                      ))}
                      {features.length > 5 && (
                        <li className="text-xs text-muted-foreground/60">
                          + {features.length - 5} recursos adicionais
                        </li>
                      )}
                    </ul>
                    <div className="space-y-2">
                      <Button
                        className="w-full gap-2 rounded-full"
                        variant={isPopular ? 'default' : 'outline'}
                        onClick={() => { setUpgradePlan(key); setPaymentChoice('card_monthly'); setShowCheckout(true); }}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        Cartão mensal
                      </Button>
                      <Button
                        className="w-full gap-2 rounded-full"
                        variant="outline"
                        onClick={() => { setUpgradePlan(key); setPaymentChoice('pix_monthly'); setShowCheckout(true); }}
                      >
                        PIX mensal
                      </Button>
                      <Button
                        className="w-full gap-2 rounded-full"
                        variant="outline"
                        onClick={() => { setUpgradePlan(key); setPaymentChoice('pix_yearly'); setShowCheckout(true); }}
                      >
                        PIX anual <span className="text-[10px] font-bold text-primary">-15%</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Legacy notice */}
      {isLegacyAccount && (
        <Card className="border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">Conta Legada</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Sua conta tem acesso completo a todos os recursos do sistema. Não é necessário selecionar um plano.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
