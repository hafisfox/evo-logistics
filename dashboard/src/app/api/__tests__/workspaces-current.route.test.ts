import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock, requireWorkspaceMembershipMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
  requireWorkspaceMembershipMock: vi.fn(),
}));

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
  requireWorkspaceMembership: requireWorkspaceMembershipMock,
}));

import { GET, POST } from "@/app/api/workspaces/current/route";

describe("/api/workspaces/current route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns current workspace details", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: {
        workspaceId: "ws-1",
        role: "owner",
        workspaceName: "Main Workspace",
        workspaceSlug: "main",
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceId: "ws-1",
      role: "owner",
      workspaceName: "Main Workspace",
      workspaceSlug: "main",
    });
  });

  it("returns onboarding response when no workspace exists", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({});
    const response = await GET();
    expect(response.status).toBe(409);
  });

  it("sets workspace cookie after valid selection", async () => {
    requireWorkspaceMembershipMock.mockResolvedValue({
      context: { workspaceId: "ws-2", role: "member", userId: "u-1" },
    });

    const request = new Request("http://localhost/api/workspaces/current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: "ws-2" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const cookieHeader = response.headers.get("set-cookie");
    expect(cookieHeader).toContain("workspace_id=ws-2");
  });
});

