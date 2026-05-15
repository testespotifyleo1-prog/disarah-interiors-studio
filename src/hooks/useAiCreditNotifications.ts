import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAiCreditBalance } from "./useAiCreditBalance";
import { useAiSimulationEnabled } from "./useAiSimulationEnabled";
import { useAuth } from "@/contexts/AuthContext";

const LOW_THRESHOLD = 3;

type Level = "zero" | "low" | "ok";

function getLevel(total: number): Level {
  if (total <= 0) return "zero";
  if (total <= LOW_THRESHOLD) return "low";
  return "ok";
}

function storageKey(accountId: string, level: Level) {
  const today = new Date().toISOString().slice(0, 10);
  return `ai_credit_notif:${accountId}:${level}:${today}`;
}

export function openBuyAiCredits() {
  window.dispatchEvent(new CustomEvent("open-buy-ai-credits"));
}

/**
 * Watches credit balance and surfaces:
 *  - "low" toast (<=3) once per day
 *  - "zero" toast once per day
 * Both include a "Comprar" action that opens the BuyAiCreditsDialog.
 */
export function useAiCreditNotifications() {
  const { currentAccount } = useAuth();
  const { enabled } = useAiSimulationEnabled();
  const { balance, loading } = useAiCreditBalance();
  const lastLevel = useRef<Level | null>(null);

  useEffect(() => {
    if (!enabled || loading || !currentAccount?.id) return;
    const level = getLevel(balance.total);

    // Only notify when level transitions to a worse state (or first load shows low/zero)
    const prev = lastLevel.current;
    lastLevel.current = level;

    if (level === "ok") return;
    // Don't re-notify within the same level on the same browser session unless transitioning back
    if (prev === level) return;

    const key = storageKey(currentAccount.id, level);
    if (typeof window !== "undefined" && window.localStorage.getItem(key)) return;

    if (level === "zero") {
      toast.error("Você ficou sem créditos de IA", {
        description: "Compre um pacote para continuar usando a Simulação Inteligente.",
        duration: 10000,
        action: { label: "Comprar", onClick: () => openBuyAiCredits() },
      });
    } else if (level === "low") {
      toast.warning(`Restam apenas ${balance.total} crédito${balance.total === 1 ? "" : "s"} de IA`, {
        description: "Garanta mais créditos para não interromper suas simulações.",
        duration: 8000,
        action: { label: "Comprar", onClick: () => openBuyAiCredits() },
      });
    }

    try {
      window.localStorage.setItem(key, "1");
    } catch {
      /* noop */
    }
  }, [balance.total, loading, enabled, currentAccount?.id]);
}
