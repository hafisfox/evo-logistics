"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMarketRates, useRefreshMarketRates } from "@/hooks/use-market-rates";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const inputClass =
  "rounded-xl border-black/10 dark:border-white/10 bg-background shadow-sm px-4 h-11 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all";

const emptyLane = {
  origin: "",
  destination: "",
  equipment_type: "",
  weight_lbs: "",
  nmfc_class: "",
};

export function MarketRatesTab() {
  const { data: rates, isLoading } = useMarketRates();
  const { canManage, isLoading: accessLoading } = useWorkspaceAccess();
  const refresh = useRefreshMarketRates();
  const [lane, setLane] = useState({ ...emptyLane });

  const disableRefresh = useMemo(
    () => accessLoading || !canManage || refresh.isPending,
    [accessLoading, canManage, refresh.isPending]
  );

  const handleRefresh = async () => {
    const origin = lane.origin.trim();
    const destination = lane.destination.trim();
    if (!origin || !destination) {
      toast.error("Origin and destination are required");
      return;
    }
    try {
      const result = await refresh.mutateAsync({
        origin,
        destination,
        equipment_type: lane.equipment_type.trim() || null,
        weight_lbs: lane.weight_lbs.trim() ? Number(lane.weight_lbs) : null,
        nmfc_class: lane.nmfc_class.trim() || null,
      });
      const count = (result as { count?: number; mode?: string })?.count ?? 0;
      const mode = (result as { mode?: string })?.mode ?? "mock";
      toast.success(`Fetched ${count} rate(s) (${mode} mode)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh market rates");
    }
  };

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-bold tracking-tight">Market Rates (API)</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          External rate intelligence aggregated from carrier/marketplace APIs (DAT, SMC3, Uber
          Freight, Loadsmart). This is reference data for benchmarking — it is{" "}
          <span className="font-semibold">not</span> used in customer pricing. Runs in mock mode
          until provider credentials are configured.
        </p>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        {canManage && (
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-6 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-black/5 dark:border-white/5">
            <Input value={lane.origin} onChange={(e) => setLane((l) => ({ ...l, origin: e.target.value }))} placeholder="Origin ZIP" disabled={disableRefresh} className={`${inputClass} font-mono`} />
            <Input value={lane.destination} onChange={(e) => setLane((l) => ({ ...l, destination: e.target.value }))} placeholder="Dest ZIP" disabled={disableRefresh} className={`${inputClass} font-mono`} />
            <Input value={lane.equipment_type} onChange={(e) => setLane((l) => ({ ...l, equipment_type: e.target.value }))} placeholder="Equipment (VAN)" disabled={disableRefresh} className={inputClass} />
            <Input value={lane.weight_lbs} onChange={(e) => setLane((l) => ({ ...l, weight_lbs: e.target.value }))} placeholder="Weight (lbs)" disabled={disableRefresh} className={`${inputClass} font-mono`} />
            <Input value={lane.nmfc_class} onChange={(e) => setLane((l) => ({ ...l, nmfc_class: e.target.value }))} placeholder="NMFC (70)" disabled={disableRefresh} className={`${inputClass} font-mono`} />
            <Button onClick={handleRefresh} disabled={disableRefresh} className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <RefreshCw className={`mr-1.5 h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto scrollbar-hide">
            <Table className="min-w-[820px]">
              <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
                <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
                  <TableHead className="font-semibold text-muted-foreground h-12">Provider</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Carrier</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Lane</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Equipment</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Transit</TableHead>
                  <TableHead className="font-semibold text-muted-foreground h-12">Valid Until</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground h-12">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rates ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      No market rates yet. Enter a lane and click Refresh to fetch API rate intelligence.
                    </TableCell>
                  </TableRow>
                ) : null}
                {rates?.map((row) => (
                  <TableRow key={row.id} className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                    <TableCell className="font-semibold text-foreground py-3 capitalize">{row.provider.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3">{row.carrier || "—"}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground py-3">{row.origin} → {row.destination}</TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3">{row.equipment_type || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground py-3">{row.transit_time_days == null ? "—" : `${row.transit_time_days}d`}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground py-3">{row.valid_until || "—"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-foreground py-3">{formatCurrency(row.price_usd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
