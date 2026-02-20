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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Final Pricing</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">Total (AED)</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(rfq.final_price_aed)}
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">Total (USD)</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(rfq.final_price_usd, "USD")}
            </p>
          </div>
        </div>

        <Separator />

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
