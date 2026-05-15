import { Coins, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAiCreditBalance } from "@/hooks/useAiCreditBalance";
import { cn } from "@/lib/utils";

interface Props {
  onClick?: () => void;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

/**
 * Pill mostrando saldo de créditos IA do account atual.
 * Cor varia: verde (>5), amarelo (1-5), vermelho (0).
 */
export function AiCreditBalanceBadge({ onClick, className, showLabel = true, size = "md" }: Props) {
  const { balance, loading } = useAiCreditBalance();
  const total = balance.total;

  const tone =
    total === 0
      ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15"
      : total <= 5
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/15"
      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={`${balance.plan_credits} do plano + ${balance.purchased_credits} comprados`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition select-none",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        tone,
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      )}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      <span className="tabular-nums">{loading ? "—" : total}</span>
      {showLabel && <span className="hidden sm:inline">créditos IA</span>}
    </button>
  );
}
