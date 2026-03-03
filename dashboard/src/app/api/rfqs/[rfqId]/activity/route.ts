import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import type { ApiErrorPayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  const { rfqId } = await params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const { data, error } = await (supabase.from as any)("activity_logs")
    .select("id, entity_type, entity_id, action, actor_id, metadata, created_at")
    .eq("workspace_id", scope.context.workspaceId)
    .eq("entity_id", rfqId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch activity logs:", error);
    return jsonError({ error: "Failed to fetch activity logs" }, 500);
  }

  return NextResponse.json(data ?? []);
}
