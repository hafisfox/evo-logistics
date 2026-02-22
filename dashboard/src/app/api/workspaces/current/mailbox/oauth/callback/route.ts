import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  computeGoogleTokenExpiryIso,
  exchangeGoogleOAuthCode,
  fetchMailboxEmailFromGmailProfile,
  verifyMailboxOAuthStateToken,
} from "@/lib/google-gmail-oauth";
import { decryptMailboxToken, encryptMailboxToken } from "@/lib/mailbox-crypto";
import { MAILBOX_OAUTH_NONCE_COOKIE } from "@/lib/mailbox-oauth";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceMembership } from "@/lib/workspace-context";

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

    const { error } = await supabase
      .from("workspace_mailboxes")
      .upsert(
        {
          workspace_id: parsedState.workspaceId,
          email: mailboxEmail,
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
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id" }
      );

    if (error) {
      throw new Error(error.message || "Failed to persist workspace mailbox");
    }

    return clearOAuthNonce(
      redirectToWorkspaceSettings(request, { mailbox_connected: "true" })
    );
  } catch (error) {
    return clearOAuthNonce(
      redirectToWorkspaceSettings(request, {
        mailbox_error:
          error instanceof Error ? error.message : "mailbox_oauth_failed",
      })
    );
  }
}
