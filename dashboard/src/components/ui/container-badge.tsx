import { Badge } from "@/components/ui/badge";
import { parseMultiValue } from "@/lib/utils";

interface ContainerBadgeProps {
  type: string;
  qty: string;
}

export function ContainerBadge({ type, qty }: ContainerBadgeProps) {
  const types = parseMultiValue(type);
  const qtys = parseMultiValue(qty);

  return (
    <span className="inline-flex flex-wrap gap-1">
      {types.map((t, i) => (
        <Badge key={i} variant="outline" className="text-xs font-mono">
          {qtys[i] || qtys[0] || "1"}×{t}
        </Badge>
      ))}
    </span>
  );
}
