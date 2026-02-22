"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import type { MasterRFQ } from "@/types/rfq";
import { Calculator } from "lucide-react";

interface PricingBreakdownProps {
  rfq: MasterRFQ;
}

export function PricingBreakdown({ rfq }: PricingBreakdownProps) {
  if (!rfq.final_price_aed) return null;

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="pb-4 px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calculator className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg font-bold tracking-tight">Final Pricing</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl text-center shadow-inner">
            <p className="text-xs font-semibold text-muted-foreground/80 mb-1 uppercase tracking-wider">Total (AED)</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(rfq.final_price_aed)}
            </p>
          </div>
          <div className="p-4 bg-white/50 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl text-center shadow-inner">
            <p className="text-xs font-semibold text-muted-foreground/80 mb-1 uppercase tracking-wider">Total (USD)</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(rfq.final_price_usd, "USD")}
            </p>
          </div>
        </div>

        <Separator className="bg-white/10 dark:bg-white/5" />

        <div className="space-y-2 text-sm">
          {rfq.selected_agent && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selected Agent</span>
              <span className="font-medium">{rfq.selected_agent}</span>
            </div>
          )}
          {rfq.quoted_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quoted At</span>
              <span>{rfq.quoted_at}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margin</span>
            <span>13%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exchange Rate</span>
            <span>1 USD = 3.685 AED</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
