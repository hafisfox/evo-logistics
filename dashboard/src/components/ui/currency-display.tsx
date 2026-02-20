import { cn, formatCurrency } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number | string | null;
  currency?: "AED" | "USD";
  className?: string;
}

export function CurrencyDisplay({
  amount,
  currency = "AED",
  className,
}: CurrencyDisplayProps) {
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatCurrency(amount, currency)}
    </span>
  );
}
