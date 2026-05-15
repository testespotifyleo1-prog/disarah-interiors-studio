import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Plan, PlanFeature } from '@/utils/planFeatures';
import { hasPlanFeature } from '@/utils/planFeatures';

interface PlanContextType {
  plan: Plan | null;
  planLoading: boolean;
  allPlans: Plan[];
  hasFeature: (feature: PlanFeature) => boolean;
  isLegacyAccount: boolean;
  isTrialExpired: boolean;
  trialDaysLeft: number | null;
  planStatus: string | null;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { currentAccount, dataLoaded } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [planLoading, setPlanLoading] = useState(true);

  // Load all plans once
  useEffect(() => {
    supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setAllPlans(data as unknown as Plan[]);
      });
  }, []);

  // Load current account's plan
  useEffect(() => {
    if (!dataLoaded) return;
    
    const planId = (currentAccount as any)?.plan_id;
    if (!planId) {
      setPlan(null);
      setPlanLoading(false);
      return;
    }

    const fetchPlan = () => {
      setPlanLoading(true);
      supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single()
        .then(({ data }) => {
          setPlan(data ? (data as unknown as Plan) : null);
          setPlanLoading(false);
        });
    };

    fetchPlan();

    // Realtime: refletir alterações do plano feitas pelo Super Admin sem F5
    const channel = supabase
      .channel(`plan-${planId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'plans', filter: `id=eq.${planId}` },
        () => {
          fetchPlan();
          // Atualiza também a lista global
          supabase.from('plans').select('*').eq('is_active', true).order('sort_order')
            .then(({ data }) => { if (data) setAllPlans(data as unknown as Plan[]); });
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [currentAccount, dataLoaded]);

  const accountAny = currentAccount as any;
  const planStatus = accountAny?.plan_status || null;
  const trialEndsAt = accountAny?.trial_ends_at ? new Date(accountAny.trial_ends_at) : null;
  const pixAccessUntil = accountAny?.pix_access_until ? new Date(accountAny.pix_access_until) : null;
  const pixActive = pixAccessUntil ? pixAccessUntil > new Date() : false;
  const pixExpired = pixAccessUntil && !pixActive;
  
  // Legacy: no plan_id AND no trial_ends_at = old account = full access
  const isLegacyAccount = !accountAny?.plan_id && !accountAny?.trial_ends_at && !pixAccessUntil;
  
  // Trial expired: has trial_ends_at, status is trial, and date passed
  // Also expired if PIX access ended without renewal
  const isTrialExpired = (planStatus === 'trial' && trialEndsAt ? trialEndsAt < new Date() : false) || (pixExpired && !pixActive);
  
  // Days left in trial
  const trialDaysLeft = planStatus === 'trial' && trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const hasFeature = (feature: PlanFeature): boolean => {
    // Legacy accounts (no plan_id AND no trial) have full access
    if (isLegacyAccount) return true;
    
    // Trial expired and no active plan = no access
    if (isTrialExpired && !accountAny?.plan_id) return false;
    
    // Account is in trial = full access during trial
    if (planStatus === 'trial' && !isTrialExpired) return true;
    
    // Active plan = check features
    if (planStatus === 'active' && plan) {
      return hasPlanFeature(plan, feature);
    }

    // Expired/canceled with a plan = check features (grace period)
    if (plan) return hasPlanFeature(plan, feature);

    // During trial with a selected plan
    if (planStatus === 'trial' && !isTrialExpired) return true;
    
    return true;
  };

  return (
    <PlanContext.Provider value={{ 
      plan, planLoading, allPlans, hasFeature, isLegacyAccount,
      isTrialExpired, trialDaysLeft, planStatus
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (context === undefined) {
    throw new Error('usePlan must be used within a PlanProvider');
  }
  return context;
}
