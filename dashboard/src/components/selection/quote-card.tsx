"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import type { AgentQuote, QuoteSurcharges } from "@/types/rfq";
import { cn } from "@/lib/utils";
import { Check, Star, Clock, Ship, Calendar, DollarSign } from "lucide-react";

interface QuoteCardProps {
  quote: AgentQuote;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
}

function sumSurcharges(surcharges: QuoteSurcharges | null): number {
  if (!surcharges) return 0;
  return Object.values(surcharges).reduce<number>(
    (sum, val) => sum + (typeof val === "number" && Number.isFinite(val) ? val : 0),
    0
  );
}

export function QuoteCard({ quote, rank, isSelected, onSelect }: QuoteCardProps) {
  const isBest = rank === 1;
  const surchargeTotal = sumSurcharges(quote.surcharges);
  const basePrice = parseFloat(quote.price) || 0;
  const totalWithSurcharges = basePrice + surchargeTotal;
  const surchargeEntries = quote.surcharges
    ? Object.entries(quote.surcharges).filter(([, val]) => typeof val === "number" && val > 0)
    : [];

  return (
    <Card
      className={cn(
        "transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.04)]",
        "backdrop-blur-xl bg-card/60 dark:bg-card/40 border border-white/20 dark:border-white/10",
        isSelected && "ring-2 ring-primary shadow-md",
        isBest && !isSelected && "border-emerald-300/50"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{quote.agent_name}</CardTitle>
          <div className="flex gap-1.5">
            {isBest && (
              <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                <Star className="h-3 w-3 mr-1" />
                Best Price
              </Badge>
            )}
            {isSelected && (
              <Badge className="bg-primary text-primary-foreground text-xs">
                <Check className="h-3 w-3 mr-1" />
                Selected
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{quote.agent_email}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center py-2 bg-muted/50 rounded-md">
          {surchargeTotal > 0 ? (
            <>
              <CurrencyDisplay
                amount={String(totalWithSurcharges)}
                currency="USD"
                className="text-2xl font-bold"
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                Base ${basePrice.toLocaleString()} + ${surchargeTotal.toLocaleString()} surcharges
              </p>
            </>
          ) : (
            <>
              <CurrencyDisplay
                amount={quote.price}
                currency="USD"
                className="text-2xl font-bold"
              />
              <p className="text-xs text-muted-foreground mt-0.5">per shipment</p>
            </>
          )}
        </div>

        {surchargeEntries.length > 0 && (
          <div className="rounded-lg bg-muted/30 px-3 py-2 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Surcharge Breakdown
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {surchargeEntries.map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{key.toUpperCase()}</span>
                  <span className="font-medium">${Number(val).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <Ship className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Carrier:</span>
            <span className="font-medium">{quote.carrier}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">ETD:</span>
            <span className="font-medium">{quote.etd || "TBD"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Transit:</span>
            <span className="font-medium">
              {quote.transit_time ? `${quote.transit_time}d` : "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Free:</span>
            <span className="font-medium">
              {quote.free_time ? `${quote.free_time}d` : "—"}
            </span>
          </div>
        </div>

        {(quote.free_time_details?.demurrage_days != null || quote.free_time_details?.detention_days != null) && (
          <div className="text-xs text-muted-foreground text-center space-x-2">
            {quote.free_time_details.demurrage_days != null && (
              <span>Dem: {quote.free_time_details.demurrage_days}d</span>
            )}
            {quote.free_time_details.detention_days != null && (
              <span>Det: {quote.free_time_details.detention_days}d</span>
            )}
          </div>
        )}

        {(quote.validity_date || quote.validity) && (
          <p className="text-xs text-muted-foreground text-center">
            Valid until: {quote.validity_date || quote.validity}
          </p>
        )}

        {quote.conditions && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center italic">
            {quote.conditions}
          </p>
        )}

        <Button
          type="button"
          variant={isSelected ? "default" : "outline"}
          className="w-full"
          size="sm"
          onClick={onSelect}
          aria-pressed={isSelected}
          aria-label={
            isSelected
              ? `Selected quote from ${quote.agent_name} on ${quote.carrier}`
              : `Select quote from ${quote.agent_name} on ${quote.carrier}`
          }
        >
          {isSelected ? "Selected" : "Select This Quote"}
        </Button>
      </CardContent>
    </Card>
  );
}
