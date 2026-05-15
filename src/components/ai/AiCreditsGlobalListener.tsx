import { useEffect, useState } from "react";
import { BuyAiCreditsDialog } from "./BuyAiCreditsDialog";
import { useAiCreditNotifications } from "@/hooks/useAiCreditNotifications";
import { useAiSimulationEnabled } from "@/hooks/useAiSimulationEnabled";

/**
 * Mounts globally inside AppLayout:
 *  - Watches AI credit balance and shows low/zero toasts (only if feature enabled)
 *  - Listens to "open-buy-ai-credits" events to open the purchase dialog
 *    from anywhere in the app (toast actions, components, etc.)
 */
export function AiCreditsGlobalListener() {
  const { enabled } = useAiSimulationEnabled();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-buy-ai-credits", handler);
    return () => window.removeEventListener("open-buy-ai-credits", handler);
  }, []);

  if (!enabled) return null;
  return <InnerListener open={open} setOpen={setOpen} />;
}

function InnerListener({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  useAiCreditNotifications();
  return <BuyAiCreditsDialog open={open} onOpenChange={setOpen} />;
}
