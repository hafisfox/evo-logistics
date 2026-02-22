import { NextResponse } from "next/server";
import { selectAgent } from "@/lib/modal-client";
import { getSettings } from "@/lib/settings";
import { validateSelectAgentBody, type ApiErrorPayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
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
    const settings = await getSettings();

    const result = await selectAgent({
      rfq_id: rfqId,
      selected_agent: validation.data.selected_agent,
      selected_carrier: validation.data.selected_carrier,
      shipment_number: validation.data.shipment_number || "1",
      selected_by: validation.data.selected_by || "dashboard",
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
