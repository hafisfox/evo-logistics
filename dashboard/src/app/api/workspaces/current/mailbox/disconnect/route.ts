import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";

export async function POST() {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_mailboxes")
    .update({
      status: "disconnected",
      gmail_refresh_token_encrypted: null,
      gmail_access_token_encrypted: null,
      token_expires_at: null,
      watch_expiration: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", scope.context.workspaceId);

  if (error) {
    console.error("Failed to disconnect workspace mailbox:", error);
    return NextResponse.json({ error: "Failed to disconnect mailbox" }, { status: 500 });
  }

  // Audit Event
  await supabase.from("audit_events").insert({
    workspace_id: scope.context.workspaceId,
    actor_user_id: scope.context.userId,
    action: "mailbox_disconnected",
    entity_type: "workspace_mailbox",
    entity_id: scope.context.workspaceId,
  });

  return NextResponse.json({ success: true });
}
