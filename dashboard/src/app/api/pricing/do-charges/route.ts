import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('do_charges').select('*');
    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch DO charges:", error);
    return NextResponse.json(
      { error: "Failed to fetch DO charges" },
      { status: 500 }
    );
  }
}
