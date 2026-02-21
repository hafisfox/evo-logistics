import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('transportation_charges').select('*');
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
