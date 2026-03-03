"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { StatusBadge } from "@/components/rfqs/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { AgentQuote, QuoteSurcharges } from "@/types/rfq";

function sumSurcharges(surcharges: QuoteSurcharges | null): number {
  if (!surcharges) return 0;
  return Object.values(surcharges).reduce<number>(
    (sum, val) => sum + (typeof val === "number" && Number.isFinite(val) ? val : 0),
    0
  );
}

function formatSurchargeTooltip(surcharges: QuoteSurcharges | null): string {
  if (!surcharges) return "";
  const entries = Object.entries(surcharges)
    .filter(([, val]) => typeof val === "number" && val > 0)
    .map(([key, val]) => `${key.toUpperCase()}: $${Number(val).toLocaleString()}`);
  return entries.length > 0 ? entries.join(", ") : "";
}

interface QuoteTableProps {
  quotes: AgentQuote[];
}

export function QuoteTable({ quotes }: QuoteTableProps) {
  const sorted = [...quotes].sort((a, b) => {
    const pa = parseFloat(a.price) || Infinity;
    const pb = parseFloat(b.price) || Infinity;
    return pa - pb;
  });

  const bestPrice = sorted[0]?.price;

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="pb-4 px-6 pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold tracking-tight">Agent Quotes</CardTitle>
          <Badge variant="secondary" className="rounded-xl px-3 py-1 bg-white/50 dark:bg-black/50 backdrop-blur-md shadow-sm border border-white/20 dark:border-white/10">{quotes.length} quotes</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        {quotes.length === 0 ? (
          <EmptyState
            title="No quotes yet"
            description="Waiting for agent responses"
          />
        ) : (
          <div className="rounded-2xl border border-white/10 dark:border-white/5 overflow-x-auto shadow-inner bg-white/5 dark:bg-black/5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Base (USD)</TableHead>
                  <TableHead>Surcharges</TableHead>
                  <TableHead>ETD</TableHead>
                  <TableHead>Transit</TableHead>
                  <TableHead>Free Time</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((q) => {
                  const surchargeTotal = sumSurcharges(q.surcharges);
                  const surchargeTooltip = formatSurchargeTooltip(q.surcharges);
                  const ftd = q.free_time_details;
                  const freeTimeDisplay = ftd
                    ? [
                        ftd.demurrage_days != null ? `Dem: ${ftd.demurrage_days}d` : null,
                        ftd.detention_days != null ? `Det: ${ftd.detention_days}d` : null,
                        ftd.combined_days != null ? `Comb: ${ftd.combined_days}d` : null,
                      ].filter(Boolean).join(", ") || (q.free_time ? `${q.free_time}d` : "—")
                    : q.free_time ? `${q.free_time}d` : "—";

                  return (
                    <TableRow
                      key={q.match || `${q.agent_email}-${q.carrier}`}
                      className={
                        q.price === bestPrice && q.status === "Received"
                          ? "bg-emerald-50 dark:bg-emerald-950/20"
                          : undefined
                      }
                    >
                      <TableCell className="text-sm font-medium">
                        {q.agent_name}
                      </TableCell>
                      <TableCell className="text-sm">{q.carrier}</TableCell>
                      <TableCell>
                        <CurrencyDisplay amount={q.price} currency="USD" />
                      </TableCell>
                      <TableCell className="text-sm">
                        {surchargeTotal > 0 ? (
                          <span title={surchargeTooltip} className="cursor-help border-b border-dashed border-muted-foreground">
                            ${surchargeTotal.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{q.etd || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {q.transit_time ? `${q.transit_time}d` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{freeTimeDisplay}</TableCell>
                      <TableCell className="text-sm">
                        {q.validity_date || q.validity || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={q.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
