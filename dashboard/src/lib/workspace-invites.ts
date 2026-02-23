import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

interface AcceptInviteResult {
  workspaceId?: string;
  error?: string;
}

export async function acceptWorkspaceInviteForUser(
  supabase: SupabaseClient<Database>,
  user: User,
  inviteToken: string
): Promise<AcceptInviteResult> {
  const token = inviteToken.trim();
  const userEmail = (user.email || "").trim().toLowerCase();

  if (!token) return { error: "invite_missing" };
  if (!userEmail) return { error: "account_email_missing" };

  const { data: invite, error: inviteError } = await supabase
    .from("workspace_invites")
    .select("id, workspace_id, email, role, status, expires_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    return { error: "invite_not_found" };
  }

  if (invite.status !== "pending") {
    return { error: "invite_not_pending" };
  }

  if (invite.email.toLowerCase() !== userEmail) {
    return { error: "invite_email_mismatch" };
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    const expiredUpdateRes = await supabase
      .from("workspace_invites")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (expiredUpdateRes.error) {
      return { error: "invite_status_update_failed" };
    }
    return { error: "invite_expired" };
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
    return { error: "membership_upsert_failed" };
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
    return { error: "invite_status_update_failed" };
  }

  const profileUpsertRes = await supabase.from("user_profiles").upsert(
    {
      id: user.id,
      default_workspace_id: invite.workspace_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileUpsertRes.error) {
    console.error("Failed to update user profile default workspace after invite accept:", profileUpsertRes.error);
  }

  return { workspaceId: invite.workspace_id };
}
