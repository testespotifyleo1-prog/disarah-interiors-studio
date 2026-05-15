import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/contexts/PlanContext';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowLeft, LogOut, CreditCard, QrCode, Zap, Clock } from 'lucide-react';
import { Link, useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { PixManualPayment } from '@/components/payment/PixManualPayment';

interface PlanOption {
  id?: string;
  slug: string;
  name: string;
  monthly: number;
  yearly: number;
  features: string[];
}

const AI_FEATURE = '✨ Inteligência Artificial com Simulação de Ambiente';

const PLANS: PlanOption[] = [
  { slug: 'start', name: 'Typos Start', monthly: 199, yearly: 2029, features: [AI_FEATURE, 'PDV completo + PDV Rápido', 'Produtos, categorias e variantes', 'Controle de estoque', 'Clientes e fornecedores', 'Vendas e caixa', 'Financeiro básico', 'Crediário básico', 'Fiscal básico (NFC-e)', 'Relatórios principais'] },
  { slug: 'pro', name: 'Typos Pro', monthly: 349, yearly: 3559, features: [AI_FEATURE, 'Tudo do Start', 'Orçamentos e pré-venda', 'Pedidos de compra', 'Sugestão de reposição', 'Transferência entre lojas', 'Comissões', 'Devoluções', 'Entradas fiscais', 'Importação em massa', 'Etiquetas'] },
  { slug: 'multi', name: 'Typos Multi', monthly: 597, yearly: 6089, features: [AI_FEATURE, 'Tudo do Pro', 'Multi-loja robusto', 'Gestão operacional entre lojas', 'Fluxo avançado de transferências', 'Suporte prioritário'] },
  { slug: 'prime', name: 'Typos Prime', monthly: 897, yearly: 9150, features: [AI_FEATURE, 'Tudo do Multi', 'WhatsApp com chatbot IA', 'Loja online (e-commerce)', 'Logística e entregas', 'Montagens', 'Suporte máximo'] },
];

type PaymentChoice = 'card_monthly' | 'pix_monthly' | 'pix_yearly';

export default function SelectPlan() {
  const { user, currentAccount, signOut } = useAuth();
  const { allPlans } = usePlan();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('card_monthly');
  const [showCheckout, setShowCheckout] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const preselected = searchParams.get('plan');

  if (!user) return <Navigate to="/login" replace />;
  if (!currentAccount) return <Navigate to="/onboarding" replace />;

  const accountAny = currentAccount as any;
  if (accountAny.plan_status === 'active' && accountAny.plan_id) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const activePlan = selectedPlan || (preselected ? PLANS.find(p => p.slug === preselected) || null : null);
  const planRecord = activePlan ? allPlans.find(p => p.slug === activePlan.slug) : null;

  if (showCheckout && activePlan) {
    const isPix = paymentChoice !== 'card_monthly';
    const amount = paymentChoice === 'pix_yearly' ? activePlan.yearly : activePlan.monthly;
    const label = paymentChoice === 'card_monthly' ? 'cartão / mês' : paymentChoice === 'pix_monthly' ? 'PIX / 30 dias' : 'PIX / 365 dias';

    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <div className="max-w-2xl mx-auto p-4 pt-8">
          <Button variant="ghost" onClick={() => setShowCheckout(false)} className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar aos planos
          </Button>
          <h1 className="text-2xl font-bold mb-2">Assinar {activePlan.name}</h1>
          <p className="text-muted-foreground mb-6">R$ {amount} — {label}</p>

          {isPix && planRecord ? (
            <PixManualPayment
              planId={planRecord.id}
              planName={activePlan.name}
              amount={amount}
              billingCycle={paymentChoice === 'pix_yearly' ? 'yearly' : 'monthly'}
              onCancel={() => setShowCheckout(false)}
            />
          ) : (
            <StripeEmbeddedCheckout
              priceId={`${activePlan.slug}_monthly`}
              customerEmail={user.email}
              userId={user.id}
              accountId={currentAccount.id}
              paymentMethod="card"
              returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="max-w-6xl mx-auto p-4 pt-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Escolha seu plano</h1>
          <p className="text-muted-foreground">
            {accountAny.plan_status === 'trial'
              ? 'Seu período de teste terminou. Escolha um plano para continuar usando o Typos!'
              : 'Selecione o plano ideal para o seu negócio.'}
          </p>
        </div>

        {/* Payment options info */}
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/20 p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">💳 Cartão — Liberação imediata</h3>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                Pagou, ativou. Acesso liberado na hora, sem espera.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/20 p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">📲 PIX — Liberação em até 1 hora</h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Pague o PIX <strong>antes do vencimento</strong> para evitar conta inativa.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map(p => {
            const isPopular = p.slug === 'pro';
            return (
              <div
                key={p.slug}
                className={`rounded-2xl border p-6 flex flex-col relative ${
                  isPopular ? 'border-2 border-primary shadow-xl shadow-primary/10' : 'border-border'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-[10px] font-bold uppercase">
                    Mais popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                <div className="mt-3 mb-1">
                  <span className="text-3xl font-black text-foreground">R$ {p.monthly}</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">ou R$ {p.yearly} anual no PIX</p>
                <ul className="space-y-2 flex-1 text-sm">
                  {p.features.map(f => {
                    const isAi = f === AI_FEATURE;
                    return (
                      <li
                        key={f}
                        className={`flex items-start gap-2 ${
                          isAi ? 'text-foreground font-semibold' : 'text-muted-foreground'
                        }`}
                      >
                        <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${isAi ? 'text-amber-500' : 'text-primary'}`} /> {f}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[10px] leading-tight text-muted-foreground/80 italic">
                  * Recursos de IA estão sujeitos ao consumo de créditos.
                </p>

                <div className="mt-6 space-y-2">
                  <Button
                    onClick={() => { setSelectedPlan(p); setPaymentChoice('card_monthly'); setShowCheckout(true); }}
                    className="w-full rounded-full font-semibold gap-2"
                    variant={isPopular ? 'default' : 'outline'}
                  >
                    <CreditCard className="h-4 w-4" /> Cartão mensal
                  </Button>
                  <Button
                    onClick={() => { setSelectedPlan(p); setPaymentChoice('pix_monthly'); setShowCheckout(true); }}
                    className="w-full rounded-full font-semibold gap-2"
                    variant="outline"
                  >
                    <QrCode className="h-4 w-4" /> PIX mensal
                  </Button>
                  <Button
                    onClick={() => { setSelectedPlan(p); setPaymentChoice('pix_yearly'); setShowCheckout(true); }}
                    className="w-full rounded-full font-semibold gap-2"
                    variant="outline"
                  >
                    <QrCode className="h-4 w-4" /> PIX anual <span className="text-[10px] font-bold text-primary">-15%</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Link to="/app/dashboard">
            <Button variant="ghost" className="text-muted-foreground">
              Voltar ao dashboard
            </Button>
          </Link>
          <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground gap-2">
            <LogOut className="h-4 w-4" /> Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
