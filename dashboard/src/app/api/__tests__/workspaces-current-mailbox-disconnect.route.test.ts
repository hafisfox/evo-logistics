import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const { createClientMock, fromMock, updateMock, eqMock, insertMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  const updateMock = vi.fn(() => ({ eq: eqMock }));
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn(() => ({ update: updateMock, insert: insertMock }));
  const createClientMock = vi.fn();
  return {
    createClientMock,
    fromMock,
    updateMock,
    eqMock,
    insertMock,
  };
});

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/workspaces/current/mailbox/disconnect/route";

describe("/api/workspaces/current/mailbox/disconnect route", () => {
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
    eqMock.mockResolvedValue({ error: null });
  });

  it("clears mailbox oauth tokens and marks workspace mailbox disconnected", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("workspace_mailboxes");
    expect(updateMock).toHaveBeenCalledTimes(1);
    const firstCall = (updateMock as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const payload = (firstCall?.[0] ?? {}) as Record<string, unknown>;
    expect(payload.status).toBe("disconnected");
    expect(payload.gmail_refresh_token_encrypted).toBeNull();
    expect(payload.gmail_access_token_encrypted).toBeNull();
    expect(payload.token_expires_at).toBeNull();
    expect(payload.watch_expiration).toBeNull();
    expect(eqMock).toHaveBeenCalledWith("workspace_id", "ws-1");
  });

  it("passes through auth context failures", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const response = await POST();
    expect(response.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
