"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import type { AgentQuote } from "@/types/rfq";
import { cn } from "@/lib/utils";
import { Check, Star, Clock, Ship, Calendar } from "lucide-react";

interface QuoteCardProps {
  quote: AgentQuote;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
}

export function QuoteCard({ quote, rank, isSelected, onSelect }: QuoteCardProps) {
  const isBest = rank === 1;

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary shadow-md",
        isBest && !isSelected && "border-emerald-300"
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
          <CurrencyDisplay
            amount={quote.price}
            currency="USD"
            className="text-2xl font-bold"
          />
          <p className="text-xs text-muted-foreground mt-0.5">per container</p>
        </div>

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

        {quote.validity && (
          <p className="text-xs text-muted-foreground text-center">
            Valid until: {quote.validity}
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
