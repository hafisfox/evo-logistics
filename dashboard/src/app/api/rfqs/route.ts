import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MasterRFQ } from "@/types/rfq";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('master_rfqs')
      .select('*')
      .order('received_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data as MasterRFQ[]);
  } catch (error) {
    console.error("Failed to fetch RFQs:", error);
    return NextResponse.json(
      { error: "Failed to fetch RFQs" },
      { status: 500 }
    );
  }
}
