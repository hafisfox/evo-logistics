import { NextResponse } from "next/server";
import { selectAgent } from "@/lib/modal-client";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  try {
    const { rfqId } = await params;
    const body = await request.json();

    // Fetch dynamic settings to use in Modal Serverless Action
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    const settingsResponse = await fetch(`${protocol}://${host}/api/settings`);
    const settings = await settingsResponse.json();

    const result = await selectAgent({
      rfq_id: rfqId,
      selected_agent: body.selected_agent,
      selected_carrier: body.selected_carrier,
      shipment_number: body.shipment_number || "1",
      selected_by: body.selected_by || "dashboard",
      exchange_rate: settings.exchangeRate,
      margin: settings.profitMargin / 100, // Important: convert % back to decimal, assuming dashboard uses whole numbers
      quote_threshold: settings.quoteThreshold,
      rounding: settings.rounding
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
