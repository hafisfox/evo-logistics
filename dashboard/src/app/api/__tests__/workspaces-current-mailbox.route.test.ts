import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const {
  createClientMock,
  fromMock,
  eqMock,
  maybeSingleMock,
  upsertMock,
  upsertSingleMock,
} = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const upsertSingleMock = vi.fn();
  const upsertSelectMock = vi.fn(() => ({ single: upsertSingleMock }));
  const upsertMock = vi.fn(() => ({ select: upsertSelectMock }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
    upsert: upsertMock,
  }));
  const createClientMock = vi.fn();

  return {
    createClientMock,
    fromMock,
    eqMock,
    maybeSingleMock,
    upsertMock,
    upsertSingleMock,
  };
});

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { GET, POST } from "@/app/api/workspaces/current/mailbox/route";

describe("/api/workspaces/current/mailbox route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      data: {
        email: "ops@example.com",
        status: "connected",
        token_expires_at: "2026-02-22T00:30:00.000Z",
        watch_expiration: null,
        last_error: null,
        updated_at: "2026-02-22T00:00:00.000Z",
      },
      error: null,
    });
    upsertSingleMock.mockResolvedValue({
      data: {
        email: "ops@example.com",
        status: "disconnected",
        token_expires_at: null,
        watch_expiration: null,
        last_error: null,
        updated_at: "2026-02-22T00:00:00.000Z",
      },
      error: null,
    });
  });

  it("returns current workspace mailbox", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mailbox: {
        email: "ops@example.com",
        status: "connected",
        token_expires_at: "2026-02-22T00:30:00.000Z",
        watch_expiration: null,
        last_error: null,
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });

    expect(fromMock).toHaveBeenCalledWith("workspace_mailboxes");
    expect(eqMock).toHaveBeenCalledWith("workspace_id", "ws-1");
  });

  it("rejects invalid email payload", async () => {
    const request = new Request("http://localhost/api/workspaces/current/mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad-email" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid mailbox payload",
    });
  });

  it("rejects manual connected status writes", async () => {
    const request = new Request("http://localhost/api/workspaces/current/mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "Ops@Example.com",
        status: "connected",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Connected mailbox status must be established through OAuth flow",
    });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("upserts disconnected mailbox for owner/admin", async () => {
    const request = new Request("http://localhost/api/workspaces/current/mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "Ops@Example.com",
        status: "disconnected",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalled();
    const firstCall = (upsertMock as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const payload = (firstCall?.[0] ?? {}) as Record<string, unknown>;
    expect(payload.workspace_id).toBe("ws-1");
    expect(payload.email).toBe("ops@example.com");
    expect(payload.status).toBe("disconnected");
    expect(payload.gmail_refresh_token_encrypted).toBeNull();
    expect(payload.gmail_access_token_encrypted).toBeNull();
    await expect(response.json()).resolves.toEqual({
      success: true,
      mailbox: {
        email: "ops@example.com",
        status: "disconnected",
        token_expires_at: null,
        watch_expiration: null,
        last_error: null,
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });
  });

  it("returns unauthorized/forbidden passthrough", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const response = await GET();
    expect(response.status).toBe(403);
  });
});
