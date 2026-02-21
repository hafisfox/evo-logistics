import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MasterRFQ, AgentQuote } from "@/types/rfq";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  try {
    const { rfqId } = await params;
    const supabase = await createClient();

    // Splitting queries to avoid Promise.all never inference issues with .single()
    const rfqRes = await supabase.from('master_rfqs').select('*').eq('rfq_id', rfqId).single();
    if (rfqRes.error && rfqRes.error.code !== 'PGRST116') {
      throw rfqRes.error;
    }

    const quotesRes = await supabase.from('agent_outbound_log').select('*').eq('rfq_id', rfqId);
    if (quotesRes.error) throw quotesRes.error;

    const rfqData = rfqRes.data as unknown as MasterRFQ;

    if (!rfqData) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    return NextResponse.json({
      rfq: rfqData as MasterRFQ,
      quotes: (quotesRes.data || []) as AgentQuote[]
    });
  } catch (error) {
    console.error("Failed to fetch RFQ detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch RFQ detail" },
      { status: 500 }
    );
  }
}
