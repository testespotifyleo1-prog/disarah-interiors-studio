import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AiCreditBalance {
  plan_credits: number;
  purchased_credits: number;
  total: number;
  total_consumed: number;
}

export function useAiCreditBalance() {
  const { currentAccount } = useAuth();
  const [balance, setBalance] = useState<AiCreditBalance>({
    plan_credits: 0,
    purchased_credits: 0,
    total: 0,
    total_consumed: 0,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentAccount?.id) {
      setBalance({ plan_credits: 0, purchased_credits: 0, total: 0, total_consumed: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    // Garante grant mensal
    await supabase.rpc("grant_monthly_ai_credits", { _account_id: currentAccount.id });
    const { data } = await supabase
      .from("ai_credit_balances")
      .select("plan_credits, purchased_credits, total_consumed")
      .eq("account_id", currentAccount.id)
      .maybeSingle();

    const plan = data?.plan_credits ?? 0;
    const purchased = data?.purchased_credits ?? 0;
    setBalance({
      plan_credits: plan,
      purchased_credits: purchased,
      total: plan + purchased,
      total_consumed: data?.total_consumed ?? 0,
    });
    setLoading(false);
  }, [currentAccount?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime updates
  useEffect(() => {
    if (!currentAccount?.id) return;
    const channel = supabase
      .channel(`ai_balance_${currentAccount.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_credit_balances",
          filter: `account_id=eq.${currentAccount.id}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentAccount?.id, refresh]);

  return { balance, loading, refresh };
}
