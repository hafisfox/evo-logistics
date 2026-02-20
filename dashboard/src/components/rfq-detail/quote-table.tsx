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
import type { AgentQuote } from "@/types/rfq";

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Agent Quotes</CardTitle>
          <Badge variant="secondary">{quotes.length} quotes</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 ? (
          <EmptyState
            title="No quotes yet"
            description="Waiting for agent responses"
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Price (USD)</TableHead>
                  <TableHead>ETD</TableHead>
                  <TableHead>Transit</TableHead>
                  <TableHead>Free Time</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((q) => (
                  <TableRow
                    key={q.match || `${q.agent_email}-${q.carrier}`}
                    className={
                      q.price === bestPrice && q.status === "Received"
                        ? "bg-emerald-50"
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
                    <TableCell className="text-sm">{q.etd || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {q.transit_time ? `${q.transit_time}d` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {q.free_time ? `${q.free_time}d` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {q.validity || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={q.status} />
                    </TableCell>
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
