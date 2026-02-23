import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCachedDashboardSummary } from "@/lib/dashboard-summary";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }

  try {
    const supabase = await createClient();
    const summary = await getCachedDashboardSummary({
      workspaceId: scope.context.workspaceId,
      supabase,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to fetch dashboard summary:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard summary" }, { status: 500 });
  }
}
