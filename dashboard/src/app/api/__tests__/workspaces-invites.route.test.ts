import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceMembershipMock } = vi.hoisted(() => ({
  requireWorkspaceMembershipMock: vi.fn(),
}));

const {
  createClientMock,
  fromMock,
  insertMock,
  singleMock,
} = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn(() => ({ single: singleMock }));
  const insertMock = vi.fn(() => ({ select: selectMock }));
  const fromMock = vi.fn(() => ({
    insert: insertMock,
  }));
  const createClientMock = vi.fn();

  return {
    createClientMock,
    fromMock,
    insertMock,
    singleMock,
  };
});

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceMembership: requireWorkspaceMembershipMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/workspaces/[workspaceId]/invites/route";

describe("/api/workspaces/[workspaceId]/invites route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireWorkspaceMembershipMock.mockResolvedValue({
      context: {
        workspaceId: "ws-1",
        role: "member",
        userId: "u-1",
      },
    });

    createClientMock.mockResolvedValue({
      from: fromMock,
    });

    singleMock.mockResolvedValue({
      data: {
        id: "inv-1",
        email: "teammate@example.com",
        role: "member",
        status: "pending",
        expires_at: "2026-03-01T00:00:00.000Z",
        invite_token: "token-1",
      },
      error: null,
    });
  });

  it("allows members to create member invites", async () => {
    const request = new Request("http://localhost/api/workspaces/ws-1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "Teammate@Example.com",
        role: "member",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });

    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = (insertMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(payload?.role).toBe("member");
    expect(payload?.invited_by).toBe("u-1");
  });

  it("rejects member-created admin invites", async () => {
    const request = new Request("http://localhost/api/workspaces/ws-1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "teammate@example.com",
        role: "admin",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Members can only invite users with member role",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("still allows owner/admin to create admin invites", async () => {
    requireWorkspaceMembershipMock.mockResolvedValue({
      context: {
        workspaceId: "ws-1",
        role: "owner",
        userId: "u-owner",
      },
    });

    const request = new Request("http://localhost/api/workspaces/ws-1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "adminuser@example.com",
        role: "admin",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });

    expect(response.status).toBe(200);
    const payload = (insertMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(payload?.role).toBe("admin");
    expect(payload?.invited_by).toBe("u-owner");
  });

  it("returns 400 for invalid email payloads", async () => {
    const request = new Request("http://localhost/api/workspaces/ws-1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "invalid-email",
        role: "member",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Valid email is required",
    });
  });

  it("returns 400 for invalid role payloads", async () => {
    const request = new Request("http://localhost/api/workspaces/ws-1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "teammate@example.com",
        role: "owner",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "role must be admin or member",
    });
  });
});
