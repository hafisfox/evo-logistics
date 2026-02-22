import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSettingsMock, updateSettingsMock } = vi.hoisted(() => ({
  getSettingsMock: vi.fn(),
  updateSettingsMock: vi.fn(),
}));

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

vi.mock("@/lib/settings", () => ({
  getSettings: getSettingsMock,
  updateSettings: updateSettingsMock,
}));

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

import { GET, POST } from "@/app/api/settings/route";

describe("/api/settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", role: "owner", userId: "user-1" },
    });
  });

  it("returns settings from GET", async () => {
    getSettingsMock.mockResolvedValue({ profitMargin: 13, quoteThreshold: 2 });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(getSettingsMock).toHaveBeenCalledWith("ws-1");
    await expect(response.json()).resolves.toEqual({
      profitMargin: 13,
      quoteThreshold: 2,
    });
  });

  it("returns unauthorized when workspace context is missing", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const response = await GET();
    expect(response.status).toBe(401);
    expect(getSettingsMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON in POST", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid settings payload",
    });
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it("rejects invalid settings payload", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profitMargin: 120 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid settings payload");
    expect(body.details).toContain("profitMargin must be between 0 and 50.");
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it("updates settings for valid payload", async () => {
    updateSettingsMock.mockResolvedValue({ profitMargin: 15, quoteThreshold: 3 });

    const request = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profitMargin: 15, quoteThreshold: 3 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(updateSettingsMock).toHaveBeenCalledWith("ws-1", {
      profitMargin: 15,
      quoteThreshold: 3,
    });

    await expect(response.json()).resolves.toEqual({
      success: true,
      settings: { profitMargin: 15, quoteThreshold: 3 },
    });
  });
});
