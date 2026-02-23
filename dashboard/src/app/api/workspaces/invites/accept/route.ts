import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const token =
    typeof body === "object" &&
    body !== null &&
    "token" in body &&
    typeof body.token === "string"
      ? body.token
      : null;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const { data: invite, error: inviteError } = await supabase
    .from("workspace_invites")
    .select("id, workspace_id, email, role, status, expires_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.status !== "pending") {
    return NextResponse.json({ error: "Invite is not pending" }, { status: 400 });
  }

  if (invite.email.toLowerCase() !== (user.email || "").toLowerCase()) {
    return NextResponse.json({ error: "Invite email does not match current account" }, { status: 403 });
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    const expiredUpdateRes = await supabase
      .from("workspace_invites")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (expiredUpdateRes.error) {
      console.error("Failed to mark invite as expired:", expiredUpdateRes.error);
      return NextResponse.json({ error: "Failed to update invite status" }, { status: 500 });
    }
    return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
  }

  const membershipRes = await supabase.from("workspace_members").upsert(
    {
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: invite.role,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,user_id" }
  );

  if (membershipRes.error) {
    console.error("Failed to create membership from invite:", membershipRes.error);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }

  const inviteUpdateRes = await supabase
    .from("workspace_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (inviteUpdateRes.error) {
    console.error("Failed to update invite status after membership upsert:", inviteUpdateRes.error);
    return NextResponse.json({ error: "Failed to update invite status" }, { status: 500 });
  }

  const profileUpsertRes = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        default_workspace_id: invite.workspace_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (profileUpsertRes.error) {
    console.error(
      "Failed to update default workspace after invite acceptance:",
      profileUpsertRes.error
    );
  }

  const response = NextResponse.json({ success: true, workspace_id: invite.workspace_id });
  response.cookies.set("workspace_id", invite.workspace_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
