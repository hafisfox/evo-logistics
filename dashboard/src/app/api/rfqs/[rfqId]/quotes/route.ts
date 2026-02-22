import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AgentQuote } from "@/types/rfq";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }
  const workspaceId = scope.context.workspaceId;

  try {
    const { rfqId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agent_outbound_log')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('rfq_id', rfqId);

    if (error) throw error;
    const quotes = (data || []) as AgentQuote[];

    // Sort by price ascending (cheapest first)
    quotes.sort((a, b) => {
      const pa = parseFloat(a.price) || Infinity;
      const pb = parseFloat(b.price) || Infinity;
      return pa - pb;
    });

    return NextResponse.json(quotes);
  } catch (error) {
    console.error("Failed to fetch quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
