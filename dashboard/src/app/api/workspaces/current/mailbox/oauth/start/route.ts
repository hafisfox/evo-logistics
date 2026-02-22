import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildMailboxGoogleConsentUrl } from "@/lib/google-gmail-oauth";
import {
  MAILBOX_OAUTH_NONCE_COOKIE,
  OAUTH_NONCE_MAX_AGE_SECONDS,
} from "@/lib/mailbox-oauth";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";

export async function GET(request: Request) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }

  const supabase = await createClient();
  const { data: mailbox } = await supabase
    .from("workspace_mailboxes")
    .select("email")
    .eq("workspace_id", scope.context.workspaceId)
    .maybeSingle();

  const nonce = randomBytes(24).toString("hex");
  const authorizationUrl = buildMailboxGoogleConsentUrl({
    request,
    workspaceId: scope.context.workspaceId,
    nonce,
    loginHint: mailbox?.email ?? null,
  });

  (await cookies()).set(MAILBOX_OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_NONCE_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ authorizationUrl });
}
