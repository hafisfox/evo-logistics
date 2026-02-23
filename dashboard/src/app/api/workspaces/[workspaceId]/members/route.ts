import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceMembership } from "@/lib/workspace-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceMembership(workspaceId);
  if (access.response) return access.response;
  if (!access.context) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, status, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load workspace members:", error);
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceMembership(workspaceId, ["owner", "admin"]);
  if (access.response) return access.response;
  if (!access.context) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const memberId =
    typeof body === "object" &&
      body !== null &&
      "member_id" in body &&
      typeof body.member_id === "string"
      ? body.member_id
      : null;
  const role =
    typeof body === "object" &&
      body !== null &&
      "role" in body &&
      typeof body.role === "string"
      ? body.role
      : null;

  if (!memberId || !role || !["owner", "admin", "member"].includes(role)) {
    return NextResponse.json({ error: "member_id and valid role are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ role: role as "owner" | "admin" | "member", updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", memberId);

  if (error) {
    console.error("Failed to update member role:", error);
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
