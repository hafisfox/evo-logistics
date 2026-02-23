import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceMembership } from "@/lib/workspace-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceMembership(workspaceId, ["owner", "admin", "member"]);
  if (access.response) return access.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id, email, role, status, expires_at, created_at, invite_token")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load invites:", error);
    return NextResponse.json({ error: "Failed to load invites" }, { status: 500 });
  }

  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceMembership(workspaceId, ["owner", "admin", "member"]);
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

  const email =
    typeof body === "object" &&
      body !== null &&
      "email" in body &&
      typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  const role =
    typeof body === "object" &&
      body !== null &&
      "role" in body &&
      typeof body.role === "string"
      ? body.role
      : "member";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "role must be admin or member" }, { status: 400 });
  }

  if (access.context.role === "member" && role !== "member") {
    return NextResponse.json(
      { error: "Members can only invite users with member role" },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email,
      role: role as "admin" | "member",
      invited_by: access.context.userId,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id, email, role, status, expires_at, invite_token")
    .single();

  if (error || !data) {
    console.error("Failed to create invite:", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    invite: data,
    inviteLink: `/signup?invite=${data.invite_token}`,
  });
}
