import { ArrowRight } from "lucide-react";
import { parseMultiValue } from "@/lib/utils";

interface RouteDisplayProps {
  pol: string;
  pod: string;
}

export function RouteDisplay({ pol, pod }: RouteDisplayProps) {
  const polFirst = parseMultiValue(pol)[0] || "—";
  const podFirst = parseMultiValue(pod)[0] || "—";

  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="font-medium">{polFirst}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{podFirst}</span>
    </span>
  );
}
