import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MasterRFQ } from "@/types/rfq";
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
  const workspaceId = scope.context.workspaceId;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('master_rfqs')
      .select('*')
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order('received_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data as MasterRFQ[]);
  } catch (error) {
    console.error("Failed to fetch RFQs:", error);
    return NextResponse.json(
      { error: "Failed to fetch RFQs" },
      { status: 500 }
    );
  }
}
