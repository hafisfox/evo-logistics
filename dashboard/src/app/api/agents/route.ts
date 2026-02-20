import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase";
import type { Agent } from "@/types/agent";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('agents').select('*');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
