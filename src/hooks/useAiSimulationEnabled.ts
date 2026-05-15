import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { isAiBlocked } from "@/utils/accountModules";

/**
 * Feature flag for AI Simulation (premium):
 *  - Per-account override: accounts.ai_simulation_enabled (true/false/null)
 *  - Global toggle: site_settings key="ai_simulation_enabled_global" (string "true"/"false")
 *  - Plan gate: legacy accounts and trial = enabled; otherwise plan must include 'ai_simulation'
 * Account override (when not null) wins over global. Plan gate is independent.
 */
export function useAiSimulationEnabled() {
  const { currentAccount } = useAuth();
  const { isLegacyAccount, planStatus, plan, isTrialExpired } = usePlan();
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "ai_simulation_enabled_global")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setGlobalEnabled((data?.value ?? "true") !== "false");
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const accOverride = (currentAccount as any)?.ai_simulation_enabled;
  const flagEnabled = accOverride === null || accOverride === undefined ? globalEnabled : Boolean(accOverride);

  // Plan-based: legacy / active trial = ok; otherwise plan must include feature
  let planAllows = false;
  if (isLegacyAccount) planAllows = true;
  else if (planStatus === "trial" && !isTrialExpired) planAllows = true;
  else if (plan && (plan.features as string[]).includes("ai_simulation")) planAllows = true;

  const accountAiBlocked = isAiBlocked(currentAccount);
  return { enabled: flagEnabled && planAllows && !accountAiBlocked, loading, flagEnabled, planAllows };
}
