import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
      .from('agents')
      .select('*')
      .eq("workspace_id", workspaceId);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
