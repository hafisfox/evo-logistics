"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import type { AgentQuote } from "@/types/rfq";
import { Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: AgentQuote | null;
  rfqId: string;
  onConfirm: () => void;
  isLoading: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  quote,
  rfqId,
  onConfirm,
  isLoading,
}: ConfirmDialogProps) {
  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Agent Selection</DialogTitle>
          <DialogDescription>
            You are about to select this agent for RFQ {rfqId}. This will
            trigger the pricing calculation and send a quotation to the customer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Agent:</span>
            <span className="font-medium">{quote.agent_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Carrier:</span>
            <span className="font-medium">{quote.carrier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price:</span>
            <CurrencyDisplay
              amount={quote.price}
              currency="USD"
              className="font-medium"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ETD:</span>
            <span className="font-medium">{quote.etd || "TBD"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Transit:</span>
            <span className="font-medium">
              {quote.transit_time ? `${quote.transit_time} days` : "—"}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Confirm Selection"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
