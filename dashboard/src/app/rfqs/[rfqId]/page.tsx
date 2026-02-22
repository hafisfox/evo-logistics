"use client";

import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ShipmentCard } from "@/components/rfq-detail/shipment-card";
import { QuoteTable } from "@/components/rfq-detail/quote-table";
import { PricingBreakdown } from "@/components/rfq-detail/pricing-breakdown";
import { useRFQDetail } from "@/hooks/use-rfq-detail";
import { useDeleteRFQ } from "@/hooks/use-rfqs";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Trash2, UserCheck } from "lucide-react";

export default function RFQDetailPage() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const router = useRouter();
  const { data, isLoading } = useRFQDetail(rfqId);
  const deleteMutation = useDeleteRFQ();
  const { canManage } = useWorkspaceAccess();

  const deleteRFQ = async () => {
    const confirmed = window.confirm(`Delete RFQ \"${rfqId}\"?`);
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(rfqId);
      toast.success("RFQ deleted");
      router.push("/rfqs");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete RFQ");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data?.rfq) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">RFQ not found</p>
      </div>
    );
  }

  const { rfq, quotes } = data;
  const validQuotes = quotes.filter((q) => q.status === "Received");
  const canSelect = rfq.status === "Processing" && validQuotes.length >= 2;

  return (
    <div>
      <Header
        title={rfqId}
        description={`${rfq.customer_email} — ${rfq.service_type}`}
      />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rfqs">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Pipeline
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {canSelect && (
              <Button asChild>
                <Link href={`/rfqs/${rfqId}/select`}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Select Agent ({validQuotes.length} quotes)
                </Link>
              </Button>
            )}
            {canManage && (
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteRFQ}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete RFQ
              </Button>
            )}
          </div>
        </div>

        <ShipmentCard rfq={rfq} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <QuoteTable quotes={quotes} />
          </div>
          <div>
            <PricingBreakdown rfq={rfq} />
          </div>
        </div>
      </div>
    </div>
  );
}
