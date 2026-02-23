import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  computeGoogleTokenExpiryIso,
  createGmailInboxWatch,
  exchangeGoogleOAuthCode,
  fetchMailboxEmailFromGmailProfile,
  verifyMailboxOAuthStateToken,
} from "@/lib/google-gmail-oauth";
import { decryptMailboxToken, encryptMailboxToken } from "@/lib/mailbox-crypto";
import { MAILBOX_OAUTH_NONCE_COOKIE } from "@/lib/mailbox-oauth";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceMembership } from "@/lib/workspace-context";

const MAILBOX_EMAIL_CONFLICT_CONSTRAINT = "workspace_mailboxes_email_key";
const MAILBOX_ALREADY_CONNECTED_ERROR =
  "This Gmail account is already connected to another workspace. Disconnect it there first, then reconnect here.";

type WorkspaceMailboxPayload = {
  workspace_id: string;
  email: string;
  status: "connected";
  gmail_refresh_token_encrypted: string;
  gmail_access_token_encrypted: string;
  token_expires_at: string | null;
  watch_expiration: string | null;
  last_error: null;
  updated_at: string;
};

function redirectToWorkspaceSettings(request: Request, params?: Record<string, string>) {
  const url = new URL("/settings/workspace", request.url);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function clearOAuthNonce(response: NextResponse) {
  response.cookies.set(MAILBOX_OAUTH_NONCE_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}

function isMailboxEmailConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeCode = "code" in error ? String(error.code ?? "") : "";
  const maybeMessage = "message" in error ? String(error.message ?? "") : "";
  const maybeDetails = "details" in error ? String(error.details ?? "") : "";

  return (
    maybeCode === "23505" &&
    (maybeMessage.includes(MAILBOX_EMAIL_CONFLICT_CONSTRAINT) ||
      maybeDetails.includes(MAILBOX_EMAIL_CONFLICT_CONSTRAINT))
  );
}

async function tryTransferMailboxToWorkspace({
  supabase,
  mailboxEmail,
  targetWorkspaceId,
  payload,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  mailboxEmail: string;
  targetWorkspaceId: string;
  payload: WorkspaceMailboxPayload;
}) {
  const { data: mailboxByEmail, error: lookupError } = await supabase
    .from("workspace_mailboxes")
    .select("workspace_id")
    .eq("email", mailboxEmail)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message || "Failed to resolve existing mailbox ownership");
  }
  if (!mailboxByEmail || mailboxByEmail.workspace_id === targetWorkspaceId) {
    return { transferred: false, blocked: false };
  }

  const sourceMembership = await requireWorkspaceMembership(mailboxByEmail.workspace_id, [
    "owner",
    "admin",
  ]);
  if (sourceMembership.response || !sourceMembership.context) {
    return { transferred: false, blocked: true };
  }

  const { error: deleteTargetError } = await supabase
    .from("workspace_mailboxes")
    .delete()
    .eq("workspace_id", targetWorkspaceId);
  if (deleteTargetError) {
    throw new Error(deleteTargetError.message || "Failed to prepare workspace mailbox transfer");
  }

  const { error: transferError } = await supabase
    .from("workspace_mailboxes")
    .update(payload)
    .eq("workspace_id", mailboxByEmail.workspace_id);
  if (transferError) {
    throw new Error(transferError.message || "Failed to transfer mailbox ownership");
  }

  return { transferred: true, blocked: false };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return redirectToWorkspaceSettings(request, {
      mailbox_error: "missing_oauth_code_or_state",
    });
  }

  const nonce = (await cookies()).get(MAILBOX_OAUTH_NONCE_COOKIE)?.value;
  if (!nonce) {
    return redirectToWorkspaceSettings(request, {
      mailbox_error: "oauth_nonce_missing",
    });
  }

  let parsedState: { workspaceId: string };
  try {
    parsedState = verifyMailboxOAuthStateToken(state, nonce);
  } catch (error) {
    return clearOAuthNonce(
      redirectToWorkspaceSettings(request, {
        mailbox_error:
          error instanceof Error ? error.message : "invalid_oauth_state",
      })
    );
  }

  const membership = await requireWorkspaceMembership(parsedState.workspaceId, [
    "owner",
    "admin",
  ]);
  if (membership.response || !membership.context) {
    return clearOAuthNonce(
      redirectToWorkspaceSettings(request, { mailbox_error: "forbidden" })
    );
  }

  const supabase = await createClient();

  let existingRefreshToken: string | null = null;
  const { data: existingMailbox } = await supabase
    .from("workspace_mailboxes")
    .select("gmail_refresh_token_encrypted")
    .eq("workspace_id", parsedState.workspaceId)
    .maybeSingle();

  if (existingMailbox?.gmail_refresh_token_encrypted) {
    try {
      existingRefreshToken = decryptMailboxToken(
        existingMailbox.gmail_refresh_token_encrypted,
        parsedState.workspaceId
      );
    } catch {
      existingRefreshToken = null;
    }
  }

  try {
    const tokenPayload = await exchangeGoogleOAuthCode({ request, code });
    const refreshToken = tokenPayload.refresh_token || existingRefreshToken;
    if (!refreshToken) {
      throw new Error("Google OAuth did not return a refresh token");
    }

    const mailboxEmail = await fetchMailboxEmailFromGmailProfile(
      tokenPayload.access_token
    );
    const watch = await createGmailInboxWatch(tokenPayload.access_token);

    const normalizedMailboxEmail = mailboxEmail.trim().toLowerCase();
    const mailboxPayload: WorkspaceMailboxPayload = {
      workspace_id: parsedState.workspaceId,
      email: normalizedMailboxEmail,
      status: "connected",
      gmail_refresh_token_encrypted: encryptMailboxToken(
        refreshToken,
        parsedState.workspaceId
      ),
      gmail_access_token_encrypted: encryptMailboxToken(
        tokenPayload.access_token,
        parsedState.workspaceId
      ),
      token_expires_at: computeGoogleTokenExpiryIso(tokenPayload.expires_in),
      watch_expiration: watch.expiration,
      last_error: null,
      updated_at: new Date().toISOString(),
    };

    const preTransfer = await tryTransferMailboxToWorkspace({
      supabase,
      mailboxEmail: normalizedMailboxEmail,
      targetWorkspaceId: parsedState.workspaceId,
      payload: mailboxPayload,
    });
    if (preTransfer.blocked) {
      throw new Error(MAILBOX_ALREADY_CONNECTED_ERROR);
    }

    if (!preTransfer.transferred) {
      const { error } = await supabase
        .from("workspace_mailboxes")
        .upsert(mailboxPayload, { onConflict: "workspace_id" });

      if (error) {
        if (!isMailboxEmailConflict(error)) {
          throw new Error(error.message || "Failed to persist workspace mailbox");
        }

        const recoveryTransfer = await tryTransferMailboxToWorkspace({
          supabase,
          mailboxEmail: normalizedMailboxEmail,
          targetWorkspaceId: parsedState.workspaceId,
          payload: mailboxPayload,
        });
        if (!recoveryTransfer.transferred) {
          throw new Error(MAILBOX_ALREADY_CONNECTED_ERROR);
        }
      }
    }

    await supabase.from("audit_events").insert({
      workspace_id: parsedState.workspaceId,
      actor_user_id: membership.context.userId,
      action: "mailbox_connected",
      entity_type: "workspace_mailbox",
      entity_id: parsedState.workspaceId,
      metadata: {
        watch_history_id: watch.historyId,
        watch_expiration: watch.expiration,
      },
    });

    return clearOAuthNonce(
      redirectToWorkspaceSettings(request, { mailbox_connected: "true" })
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "mailbox_oauth_failed";

    await supabase.from("audit_events").insert({
      workspace_id: parsedState?.workspaceId,
      actor_user_id: membership?.context?.userId,
      action: "mailbox_oauth_failed",
      entity_type: "workspace_mailbox",
      entity_id: parsedState?.workspaceId,
      metadata: { error: errorMessage },
    });

    return clearOAuthNonce(
      redirectToWorkspaceSettings(request, {
        mailbox_error: errorMessage,
      })
    );
  }
}
