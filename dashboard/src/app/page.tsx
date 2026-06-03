import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { getServerQueryClient } from "@/lib/query-client";
import { getCachedDashboardSummary } from "@/lib/dashboard-summary";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";

export default async function DashboardPage() {
  // Prefetch the summary on the server so the dashboard renders with data in the
  // initial HTML (no client-side fetch waterfall). Falls back silently to the
  // client query (useDashboardSummary) on any error.
  const queryClient = getServerQueryClient();
  try {
    const scope = await requireWorkspaceApiContext({
      allowedRoles: ["owner", "admin", "member"],
    });
    if (scope.context) {
      const supabase = await createClient();
      const summary = await getCachedDashboardSummary({
        workspaceId: scope.context.workspaceId,
        supabase,
      });
      queryClient.setQueryData(["dashboard-summary"], summary);
    }
  } catch (error) {
    console.error("Dashboard summary prefetch failed; falling back to client fetch:", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardHome />
    </HydrationBoundary>
  );
}
