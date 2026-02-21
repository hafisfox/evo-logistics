import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('destination_charges').select('*');
    if (error) throw error;

    // Map snake_case columns back to original Google Sheets format expected by frontend
    const mappedData = ((data || []) as Record<string, unknown>[]).map(d => ({
      "Charge Type": d.charge_type,
      Basis: d.basis,
      "20FT": d["20FT"],
      "40FT": d["40FT"]
    }));

    return NextResponse.json(mappedData);
  } catch (error) {
    console.error("Failed to fetch destination charges:", error);
    return NextResponse.json(
      { error: "Failed to fetch destination charges" },
      { status: 500 }
    );
  }
}
