import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/contexts/PlanContext';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Loader2, Clock, AlertTriangle } from 'lucide-react';
import { SellerTips } from '@/components/SellerTips';
import { SupportChatWidget } from '@/components/support/SupportChatWidget';
import { Button } from '@/components/ui/button';
import { ImpersonateBanner } from '@/components/ImpersonateBanner';
import { useWhatsAppNotifications } from '@/hooks/useWhatsAppNotifications';
import { AiCreditsGlobalListener } from '@/components/ai/AiCreditsGlobalListener';

export function AppLayout() {
  const { user, loading, currentAccount, dataLoaded } = useAuth();
  const { isTrialExpired, trialDaysLeft, planStatus, isLegacyAccount } = usePlan();
  useWhatsAppNotifications();

  if (loading || (user && !dataLoaded)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!currentAccount) return <Navigate to="/onboarding" replace />;

  // Trial expired and no plan = redirect to plan selection
  if (isTrialExpired && !(currentAccount as any)?.plan_id) {
    return <Navigate to="/select-plan" replace />;
  }

  // Expired plan status
  if (planStatus === 'expired') {
    return <Navigate to="/select-plan" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <ImpersonateBanner />
        <div className="flex flex-1 w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          {/* Trial banner */}
          {!isLegacyAccount && planStatus === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 3 && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-amber-800">
                <Clock className="h-4 w-4" />
                <span>
                  {trialDaysLeft === 0
                    ? 'Seu período de teste encerra hoje!'
                    : `Faltam ${trialDaysLeft} dia${trialDaysLeft > 1 ? 's' : ''} para o fim do teste gratuito.`}
                </span>
              </div>
              <Link to="/select-plan">
                <Button size="sm" className="rounded-full text-xs h-7">
                  Escolher plano
                </Button>
              </Link>
            </div>
          )}
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <SellerTips />
        <SupportChatWidget />
        <AiCreditsGlobalListener />
        </div>
      </div>
    </SidebarProvider>
  );
}
