import { NextResponse } from "next/server";
import { selectAgent } from "@/lib/modal-client";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  try {
    const { rfqId } = await params;
    const body = await request.json();

    const settings = await getSettings();

    const result = await selectAgent({
      rfq_id: rfqId,
      selected_agent: body.selected_agent,
      selected_carrier: body.selected_carrier,
      shipment_number: body.shipment_number || "1",
      selected_by: body.selected_by || "dashboard",
      margin: settings.profitMargin / 100, // Important: convert % back to decimal, assuming dashboard uses whole numbers
      quote_threshold: settings.quoteThreshold,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to select agent:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to select agent",
      },
      { status: 500 }
    );
  }
}
