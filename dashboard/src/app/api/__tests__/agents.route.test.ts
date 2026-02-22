import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const {
  createClientMock,
  fromMock,
  selectEqMock,
  mutationEqMock,
  insertMock,
  deleteMock,
  mutationSelectMock,
  singleMock,
} = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectEqMock = vi.fn();
  const mutationSelectMock = vi.fn(() => ({ single: singleMock }));
  const mutationEqMock = vi.fn(() => ({ eq: mutationEqMock, select: mutationSelectMock }));
  const selectMock = vi.fn(() => ({ eq: selectEqMock }));
  const insertMock = vi.fn(() => ({ select: mutationSelectMock }));
  const updateMock = vi.fn(() => ({ eq: mutationEqMock }));
  const deleteMock = vi.fn(() => ({ eq: mutationEqMock }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
  }));
  const createClientMock = vi.fn();

  return {
    createClientMock,
    fromMock,
    selectEqMock,
    mutationEqMock,
    insertMock,
    deleteMock,
    mutationSelectMock,
    singleMock,
  };
});

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { DELETE, GET, PATCH, POST } from "@/app/api/agents/route";

describe("/api/agents route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromMock });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });

    selectEqMock.mockResolvedValue({ data: [], error: null });
    singleMock.mockResolvedValue({ data: null, error: null });
  });

  it("returns agents from GET", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ agent_name: "Alpha", email: "alpha@example.com", status: "active" }],
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { agent_name: "Alpha", email: "alpha@example.com", status: "active" },
    ]);
  });

  it("creates agent with POST", async () => {
    singleMock.mockResolvedValue({
      data: { agent_name: "Alpha", email: "alpha@example.com", status: "active" },
      error: null,
    });

    const request = new Request("http://localhost/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_name: "Alpha",
        email: "alpha@example.com",
        status: "active",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      agent: { agent_name: "Alpha", email: "alpha@example.com", status: "active" },
    });
    expect(insertMock).toHaveBeenCalled();
  });

  it("returns 409 on duplicate agent create", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "agents_workspace_id_email_key"',
      },
    });

    const request = new Request("http://localhost/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_name: "Alpha",
        email: "alpha@example.com",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Agent already exists",
    });
  });

  it("rejects PATCH payload with no updatable fields", async () => {
    const request = new Request("http://localhost/api/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_agent_name: "Alpha" }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid agent payload",
    });
  });

  it("returns 404 when PATCH target agent not found", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });

    const request = new Request("http://localhost/api/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_agent_name: "Missing Agent",
        status: "inactive",
      }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Agent not found",
    });
  });

  it("deletes agent", async () => {
    mutationEqMock.mockImplementation(() => ({ eq: mutationEqMock, select: mutationSelectMock }));

    const request = new Request("http://localhost/api/agents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_name: "Alpha" }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(deleteMock).toHaveBeenCalled();
  });

  it("passes through forbidden response for mutations", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const request = new Request("http://localhost/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_name: "Alpha", email: "alpha@example.com" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});
