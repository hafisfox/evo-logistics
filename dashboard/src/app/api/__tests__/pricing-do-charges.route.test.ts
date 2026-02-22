import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const {
  createClientMock,
  fromMock,
  selectEqMock,
  mutationEqMock,
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

import { DELETE, GET, PATCH, POST } from "@/app/api/pricing/do-charges/route";

describe("/api/pricing/do-charges route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromMock });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });

    selectEqMock.mockResolvedValue({ data: [], error: null });
    singleMock.mockResolvedValue({ data: null, error: null });
  });

  it("returns DO charges from GET", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ id: 1, carrier: "MSC", document: 120, "20FT": 200, "40FT": 300, "40HQ": 350 }],
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toHaveLength(1);
  });

  it("creates DO charge row", async () => {
    singleMock.mockResolvedValue({
      data: { id: 1, carrier: "MSC", document: 120, "20FT": 200, "40FT": 300, "40HQ": 350 },
      error: null,
    });

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: "MSC",
        document: 120,
        "20FT": 200,
        "40FT": 300,
        "40HQ": 350,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("rejects invalid numeric payload", async () => {
    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: "MSC",
        document: "abc",
        "20FT": 200,
        "40FT": 300,
        "40HQ": 350,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid DO charges payload",
    });
  });

  it("returns 409 on duplicate carrier", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "do_charges_workspace_id_carrier_key"',
      },
    });

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: "MSC",
        document: 120,
        "20FT": 200,
        "40FT": 300,
        "40HQ": 350,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "DO charge for this carrier already exists",
    });
  });

  it("updates DO charge row", async () => {
    singleMock.mockResolvedValue({
      data: { id: 2, carrier: "COSCO", document: 99, "20FT": 180, "40FT": 260, "40HQ": 290 },
      error: null,
    });

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 2, document: 99 }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("returns 404 on missing DO row update", async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: "PGRST116", message: "No rows" } });

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 999, document: 99 }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "DO charge row not found" });
  });

  it("deletes DO charge row", async () => {
    mutationEqMock.mockImplementation(() => ({ eq: mutationEqMock, select: mutationSelectMock }));

    const request = new Request("http://localhost/api/pricing/do-charges", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 4 }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
