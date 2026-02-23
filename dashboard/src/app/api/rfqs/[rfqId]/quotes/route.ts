import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AgentQuote } from "@/types/rfq";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import { mapNormalizedQuoteToLegacy } from "@/lib/rfq-normalization";

export const dynamic = "force-dynamic";

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code || "") : "";
  const message =
    "message" in error ? String((error as { message?: string }).message || "") : "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("Could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

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

    const normalizedRes = await supabase
      .from("agent_quotes")
      .select("*")
      .eq('workspace_id', workspaceId)
      .eq('rfq_id', rfqId);

    let rows: Record<string, unknown>[] = [];
    if (!normalizedRes.error && (normalizedRes.data || []).length > 0) {
      rows = (normalizedRes.data || []) as Record<string, unknown>[];
    } else {
      if (normalizedRes.error && !isMissingRelationError(normalizedRes.error)) {
        throw normalizedRes.error;
      }

      const legacyRes = await supabase
        .from("agent_outbound_log")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("rfq_id", rfqId);

      if (legacyRes.error) throw legacyRes.error;
      rows = (legacyRes.data || []) as Record<string, unknown>[];
    }

    const quotes = rows.map(mapNormalizedQuoteToLegacy) as AgentQuote[];

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
