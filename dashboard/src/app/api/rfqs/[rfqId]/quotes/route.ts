import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase";
import type { AgentQuote } from "@/types/rfq";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  try {
    const { rfqId } = await params;
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from('agent_outbound_log')
      .select('*')
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
