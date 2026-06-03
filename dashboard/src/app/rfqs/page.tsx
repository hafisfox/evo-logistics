import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { RFQPipelineView } from "./rfq-pipeline-view";
import { getServerQueryClient } from "@/lib/query-client";
import { fetchWorkspaceRFQs } from "@/lib/rfqs-query";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";

export default async function RFQPipelinePage() {
  // Prefetch the RFQ list on the server so the pipeline renders with data in the
  // initial HTML. Falls back silently to the client query (useRFQs) on any error.
  const queryClient = getServerQueryClient();
  try {
    const scope = await requireWorkspaceApiContext({
      allowedRoles: ["owner", "admin", "member"],
    });
    if (scope.context) {
      const supabase = await createClient();
      const rfqs = await fetchWorkspaceRFQs(supabase, scope.context.workspaceId);
      queryClient.setQueryData(["rfqs"], rfqs);
    }
  } catch (error) {
    console.error("RFQ list prefetch failed; falling back to client fetch:", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RFQPipelineView />
    </HydrationBoundary>
  );
}
