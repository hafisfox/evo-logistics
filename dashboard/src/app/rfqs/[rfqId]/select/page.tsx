"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QuoteCard } from "@/components/selection/quote-card";
import { ConfirmDialog } from "@/components/selection/confirm-dialog";
import { useRFQDetail } from "@/hooks/use-rfq-detail";
import { useSelectAgent } from "@/hooks/use-select-agent";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { RouteDisplay } from "@/components/ui/route-display";
import { ContainerBadge } from "@/components/ui/container-badge";
import { StatusBadge } from "@/components/rfqs/status-badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { AgentQuote } from "@/types/rfq";
import Link from "next/link";

export default function AgentSelectionPage() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const router = useRouter();
  const { data, isLoading } = useRFQDetail(rfqId);
  const selectMutation = useSelectAgent();

  const [selectedQuote, setSelectedQuote] = useState<AgentQuote | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const validQuotes =
    data?.quotes.filter((q) => q.status === "Received") || [];

  // Sort by price ascending
  const sortedQuotes = [...validQuotes].sort((a, b) => {
    const pa = parseFloat(a.price) || Infinity;
    const pb = parseFloat(b.price) || Infinity;
    return pa - pb;
  });

  const handleConfirm = async () => {
    if (!selectedQuote) return;

    try {
      await selectMutation.mutateAsync({
        rfq_id: rfqId,
        selected_agent: selectedQuote.agent_name,
        selected_match: selectedQuote.match,
        selected_carrier: selectedQuote.carrier,
        shipment_number: selectedQuote.shipment_number || "1",
        selected_by: "dashboard",
      });
      toast.success("Agent selected successfully! Quotation will be sent to the customer.");
      router.push(`/rfqs/${rfqId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to select agent"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const rfq = data?.rfq;

  return (
    <div className="p-6 space-y-6">
      {/* Back button + RFQ summary */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/rfqs/${rfqId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to RFQ
          </Link>
        </Button>
      </div>

      {rfq && (
        <div className="flex items-center gap-4 flex-wrap bg-muted/50 rounded-lg p-4">
          <StatusBadge status={rfq.status} />
          <RouteDisplay pol={rfq.pol} pod={rfq.pod} />
          <ContainerBadge type={rfq.container_type} qty={rfq.qty} />
          <span className="text-sm text-muted-foreground">
            {rfq.service_type}
          </span>
          <span className="text-sm text-muted-foreground">
            {rfq.customer_email}
          </span>
        </div>
      )}

      {/* Quotes count */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {sortedQuotes.length} Quote{sortedQuotes.length !== 1 ? "s" : ""}{" "}
          Received
        </h2>
        {selectedQuote && (
          <Button onClick={() => setConfirmOpen(true)}>
            Confirm Selection: {selectedQuote.agent_name} —{" "}
            {selectedQuote.carrier}
          </Button>
        )}
      </div>

      {/* Quote cards grid */}
      {sortedQuotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedQuotes.map((quote, idx) => (
            <QuoteCard
              key={quote.match || `${quote.agent_email}-${quote.carrier}`}
              quote={quote}
              rank={idx + 1}
              isSelected={selectedQuote?.match === quote.match}
              onSelect={() => setSelectedQuote(quote)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No quotes received yet"
          description="Waiting for agents to respond with their rates"
        />
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        quote={selectedQuote}
        rfqId={rfqId}
        onConfirm={handleConfirm}
        isLoading={selectMutation.isPending}
      />
    </div>
  );
}
