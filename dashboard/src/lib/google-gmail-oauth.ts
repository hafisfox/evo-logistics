import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_VERSION = "v1";
const STATE_MAX_AGE_SECONDS = 10 * 60;
const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

export interface MailboxOAuthStatePayload {
  workspaceId: string;
  nonce: string;
  iat: number;
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

function toBase64Url(value: string | Buffer) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function resolveSiteUrl(request: Request) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "";

  if (configured) {
    const withScheme = configured.startsWith("http")
      ? configured
      : `https://${configured}`;
    return withScheme.endsWith("/") ? withScheme.slice(0, -1) : withScheme;
  }

  const origin = new URL(request.url).origin;
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

function getOAuthConfig(request: Request): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${resolveSiteUrl(request)}/api/workspaces/current/mailbox/oauth/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be configured"
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function getStateSigningSecret() {
  const secret =
    process.env.MAILBOX_OAUTH_STATE_SECRET ||
    process.env.MAILBOX_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "MAILBOX_OAUTH_STATE_SECRET (or MAILBOX_TOKEN_ENCRYPTION_KEY fallback) is not configured"
    );
  }
  return secret;
}

function signStatePayload(encodedPayload: string) {
  return createHmac("sha256", getStateSigningSecret())
    .update(`${STATE_VERSION}.${encodedPayload}`)
    .digest();
}

export function createMailboxOAuthStateToken(payload: MailboxOAuthStatePayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(signStatePayload(encodedPayload));
  return `${STATE_VERSION}.${encodedPayload}.${signature}`;
}

export function verifyMailboxOAuthStateToken(
  token: string,
  expectedNonce: string
): MailboxOAuthStatePayload {
  const [version, encodedPayload, encodedSignature] = token.split(".");
  if (
    version !== STATE_VERSION ||
    !encodedPayload ||
    !encodedSignature
  ) {
    throw new Error("Invalid OAuth state token");
  }

  const expectedSignature = signStatePayload(encodedPayload);
  const actualSignature = fromBase64Url(encodedSignature);
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));
  } catch {
    throw new Error("Invalid OAuth state payload");
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("workspaceId" in payload) ||
    !("nonce" in payload) ||
    !("iat" in payload)
  ) {
    throw new Error("Invalid OAuth state fields");
  }

  const state = payload as MailboxOAuthStatePayload;
  if (
    typeof state.workspaceId !== "string" ||
    !state.workspaceId ||
    typeof state.nonce !== "string" ||
    !state.nonce ||
    typeof state.iat !== "number" ||
    !Number.isFinite(state.iat)
  ) {
    throw new Error("Invalid OAuth state values");
  }

  if (state.nonce !== expectedNonce) {
    throw new Error("OAuth state nonce mismatch");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (state.iat > nowSeconds + 30) {
    throw new Error("OAuth state issued in the future");
  }
  if (nowSeconds - state.iat > STATE_MAX_AGE_SECONDS) {
    throw new Error("OAuth state expired");
  }

  return state;
}

export function buildMailboxGoogleConsentUrl(input: {
  request: Request;
  workspaceId: string;
  nonce: string;
  loginHint?: string | null;
}) {
  const { clientId, redirectUri } = getOAuthConfig(input.request);
  const stateToken = createMailboxOAuthStateToken({
    workspaceId: input.workspaceId,
    nonce: input.nonce,
    iat: Math.floor(Date.now() / 1000),
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_MODIFY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: stateToken,
  });
  if (input.loginHint) {
    params.set("login_hint", input.loginHint);
  }

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleOAuthCode(input: {
  request: Request;
  code: string;
}) {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig(input.request);

  const body = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!payload.access_token) {
    throw new Error("Google token response is missing access_token");
  }
  return payload;
}

export async function fetchMailboxEmailFromGmailProfile(accessToken: string) {
  const response = await fetch(GMAIL_PROFILE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Gmail profile (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as { emailAddress?: string };
  const email = payload.emailAddress?.trim().toLowerCase();
  if (!email) {
    throw new Error("Gmail profile response is missing emailAddress");
  }
  return email;
}

export function computeGoogleTokenExpiryIso(expiresInSeconds?: number) {
  if (!expiresInSeconds || !Number.isFinite(expiresInSeconds)) {
    return null;
  }
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}
