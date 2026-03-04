"use client";

import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShipmentCard } from "@/components/rfq-detail/shipment-card";
import { QuoteTable } from "@/components/rfq-detail/quote-table";
import { PricingBreakdown } from "@/components/rfq-detail/pricing-breakdown";
import { NotesSection } from "@/components/rfq-detail/notes-section";
import { ActivityTimeline } from "@/components/rfq-detail/activity-timeline";
import { useRFQDetail } from "@/hooks/use-rfq-detail";
import { useDeleteRFQ } from "@/hooks/use-rfqs";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, Trash2, UserCheck } from "lucide-react";

export default function RFQDetailPage() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const router = useRouter();
  const { data, isLoading } = useRFQDetail(rfqId);
  const deleteMutation = useDeleteRFQ();
  const { canManage } = useWorkspaceAccess();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const deleteRFQ = async () => {
    try {
      await deleteMutation.mutateAsync(rfqId);
      toast.success("RFQ deleted");
      setShowDeleteDialog(false);
      router.push("/rfqs");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete RFQ");
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-700 mt-4 md:mt-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
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
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-700 ease-out fill-mode-both mt-4 md:mt-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="h-10 rounded-xl hover:bg-white/10 dark:hover:bg-white/5 transition-all">
          <Link href="/rfqs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Pipeline
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          {canSelect && (
            <Button asChild className="h-10 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Link href={`/rfqs/${rfqId}/select`}>
                <UserCheck className="h-4 w-4 mr-2" />
                Select Agent ({validQuotes.length} quotes)
              </Link>
            </Button>
          )}
          {canManage && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteMutation.isPending}
              className="h-10 rounded-xl font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete RFQ
            </Button>
          )}
        </div>
      </div>

      <div className="animate-in slide-in-from-bottom-8 duration-700 delay-100 fill-mode-both">
        <ShipmentCard rfq={rfq} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 pt-2">
        <div className="lg:col-span-2 animate-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
          <QuoteTable quotes={quotes} />
        </div>
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
          <PricingBreakdown rfq={rfq} />
          <NotesSection rfqId={rfqId} />
          <ActivityTimeline rfqId={rfqId} />
        </div>
      </div>
      <ConfirmDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete RFQ "${rfqId}"?`}
        description="This action cannot be undone. The RFQ and all associated data will be permanently removed."
        onConfirm={deleteRFQ}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
