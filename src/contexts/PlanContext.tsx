import React, { createContext, useContext } from 'react';
type PlanFeature = string;
type Plan = { id: string; name: string };

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

// Single-tenant ERP: no plan gating. Everyone has full access.
const noopValue: PlanContextType = {
  plan: null,
  planLoading: false,
  allPlans: [],
  hasFeature: () => true,
  isLegacyAccount: true,
  isTrialExpired: false,
  trialDaysLeft: null,
  planStatus: null,
};

const PlanContext = createContext<PlanContextType>(noopValue);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  return <PlanContext.Provider value={noopValue}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  return useContext(PlanContext);
}
