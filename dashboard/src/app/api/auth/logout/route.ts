import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Failed to sign out:", error);
    return NextResponse.json({ error: "Failed to sign out" }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("workspace_id");
  response.cookies.delete("ws_member");
  return response;
}

