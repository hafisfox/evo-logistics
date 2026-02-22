import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const { createClientMock, fromMock, eqMock, maybeSingleMock } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  const createClientMock = vi.fn();
  return {
    createClientMock,
    fromMock,
    eqMock,
    maybeSingleMock,
  };
});

const { cookiesMock, cookieSetMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  cookieSetMock: vi.fn(),
}));

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { GET } from "@/app/api/workspaces/current/mailbox/oauth/start/route";

describe("/api/workspaces/current/mailbox/oauth/start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.MAILBOX_OAUTH_STATE_SECRET = "state-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

    createClientMock.mockResolvedValue({
      from: fromMock,
    });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: {
        workspaceId: "ws-1",
        role: "owner",
        userId: "u-1",
      },
    });
    maybeSingleMock.mockResolvedValue({
      data: { email: "ops@example.com" },
      error: null,
    });
    cookiesMock.mockResolvedValue({ set: cookieSetMock });
  });

  it("returns authorization url and sets oauth nonce cookie", async () => {
    const response = await GET(new Request("http://localhost/api/workspaces/current/mailbox/oauth/start"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { authorizationUrl: string };
    expect(body.authorizationUrl).toContain("accounts.google.com/o/oauth2/v2/auth");

    const parsed = new URL(body.authorizationUrl);
    expect(parsed.searchParams.get("state")).toBeTruthy();
    expect(parsed.searchParams.get("login_hint")).toBe("ops@example.com");

    expect(cookieSetMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("workspace_mailboxes");
    expect(eqMock).toHaveBeenCalledWith("workspace_id", "ws-1");
  });

  it("passes through auth context response", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const response = await GET(new Request("http://localhost/api/workspaces/current/mailbox/oauth/start"));
    expect(response.status).toBe(403);
  });
});
