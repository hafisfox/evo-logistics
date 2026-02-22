import { NextResponse } from "next/server";
import { selectAgent } from "@/lib/modal-client";
import { getSettings } from "@/lib/settings";
import { validateSelectAgentBody, type ApiErrorPayload } from "@/lib/validation";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);
  const { workspaceId, userId } = scope.context;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid select-agent payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateSelectAgentBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const { rfqId } = await params;
    const settings = await getSettings(workspaceId);

    const result = await selectAgent({
      rfq_id: rfqId,
      workspace_id: workspaceId,
      selected_by_user_id: userId,
      selected_agent: validation.data.selected_agent,
      selected_match: validation.data.selected_match,
      selected_carrier: validation.data.selected_carrier,
      shipment_number: validation.data.shipment_number || "1",
      selected_by: validation.data.selected_by || userId,
      margin: settings.profitMargin / 100,
      quote_threshold: settings.quoteThreshold,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to select agent:", error);
    return jsonError(
      {
        error: error instanceof Error ? error.message : "Failed to select agent",
      },
      500
    );
  }
}
