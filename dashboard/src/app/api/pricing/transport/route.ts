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
      .from('transportation_charges')
      .select('*')
      .eq("workspace_id", workspaceId);
    if (error) throw error;

    // Map snake_case columns back to original Google Sheets format expected by frontend
    const mappedData = ((data || []) as Record<string, unknown>[]).map(t => ({
      Place: t.place,
      Price: t.price
    }));

    return NextResponse.json(mappedData);
  } catch (error) {
    console.error("Failed to fetch transport charges:", error);
    return NextResponse.json(
      { error: "Failed to fetch transport charges" },
      { status: 500 }
    );
  }
}
