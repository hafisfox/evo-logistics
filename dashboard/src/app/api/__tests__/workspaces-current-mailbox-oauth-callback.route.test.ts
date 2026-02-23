import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceMembershipMock } = vi.hoisted(() => ({
  requireWorkspaceMembershipMock: vi.fn(),
}));

const {
  createClientMock,
  fromMock,
  maybeSingleMock,
  upsertMock,
  insertMock,
} = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const upsertMock = vi.fn();
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn(() => ({
    select: selectMock,
    upsert: upsertMock,
    insert: insertMock,
  }));
  const createClientMock = vi.fn();
  return {
    createClientMock,
    fromMock,
    maybeSingleMock,
    upsertMock,
    insertMock,
  };
});

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

const {
  verifyMailboxOAuthStateTokenMock,
  exchangeGoogleOAuthCodeMock,
  fetchMailboxEmailFromGmailProfileMock,
  computeGoogleTokenExpiryIsoMock,
} = vi.hoisted(() => ({
  verifyMailboxOAuthStateTokenMock: vi.fn(),
  exchangeGoogleOAuthCodeMock: vi.fn(),
  fetchMailboxEmailFromGmailProfileMock: vi.fn(),
  computeGoogleTokenExpiryIsoMock: vi.fn(),
}));

const { encryptMailboxTokenMock } = vi.hoisted(() => ({
  encryptMailboxTokenMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceMembership: requireWorkspaceMembershipMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/google-gmail-oauth", () => ({
  verifyMailboxOAuthStateToken: verifyMailboxOAuthStateTokenMock,
  exchangeGoogleOAuthCode: exchangeGoogleOAuthCodeMock,
  fetchMailboxEmailFromGmailProfile: fetchMailboxEmailFromGmailProfileMock,
  computeGoogleTokenExpiryIso: computeGoogleTokenExpiryIsoMock,
}));

vi.mock("@/lib/mailbox-crypto", () => ({
  encryptMailboxToken: encryptMailboxTokenMock,
  decryptMailboxToken: vi.fn(),
}));

import { GET } from "@/app/api/workspaces/current/mailbox/oauth/callback/route";

describe("/api/workspaces/current/mailbox/oauth/callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createClientMock.mockResolvedValue({
      from: fromMock,
    });
    requireWorkspaceMembershipMock.mockResolvedValue({
      context: {
        workspaceId: "ws-1",
        role: "owner",
        userId: "u-1",
      },
    });
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "nonce-123" })),
    });
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    verifyMailboxOAuthStateTokenMock.mockReturnValue({
      workspaceId: "ws-1",
      nonce: "nonce-123",
      iat: Math.floor(Date.now() / 1000),
    });
    exchangeGoogleOAuthCodeMock.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
    });
    fetchMailboxEmailFromGmailProfileMock.mockResolvedValue("ops@example.com");
    computeGoogleTokenExpiryIsoMock.mockReturnValue("2026-02-23T00:00:00.000Z");
    encryptMailboxTokenMock.mockImplementation((value: string) => `enc:${value}`);
    upsertMock.mockResolvedValue({ error: null });
  });

  it("stores encrypted tokens and redirects to workspace settings", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/workspaces/current/mailbox/oauth/callback?code=abc&state=state-token"
      )
    );

    expect(requireWorkspaceMembershipMock).toHaveBeenCalledWith("ws-1", [
      "owner",
      "admin",
    ]);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [payload] = upsertMock.mock.calls[0] as [Record<string, unknown>];
    expect(payload.workspace_id).toBe("ws-1");
    expect(payload.email).toBe("ops@example.com");
    expect(payload.status).toBe("connected");
    expect(payload.gmail_refresh_token_encrypted).toBe("enc:refresh-token");
    expect(payload.gmail_access_token_encrypted).toBe("enc:access-token");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/settings/workspace?mailbox_connected=true"
    );
    expect(response.headers.get("set-cookie")).toContain(
      "workspace_mailbox_oauth_nonce="
    );
  });

  it("redirects with error when oauth nonce cookie is missing", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });

    const response = await GET(
      new Request(
        "http://localhost/api/workspaces/current/mailbox/oauth/callback?code=abc&state=state-token"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/settings/workspace?mailbox_error=oauth_nonce_missing"
    );
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
