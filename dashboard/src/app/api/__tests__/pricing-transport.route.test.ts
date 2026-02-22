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
  updateMock,
  deleteMock,
  selectMock,
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
    updateMock,
    deleteMock,
    selectMock,
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

import { DELETE, GET, PATCH, POST } from "@/app/api/pricing/transport/route";

describe("/api/pricing/transport route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromMock });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });

    selectEqMock.mockResolvedValue({ data: [], error: null });
    singleMock.mockResolvedValue({ data: null, error: null });
  });

  it("maps GET rows into dashboard format with id", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ id: 3, place: "Jebel Ali", price: 550 }],
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: 3, Place: "Jebel Ali", Price: 550 },
    ]);
  });

  it("creates transport charge row", async () => {
    singleMock.mockResolvedValue({
      data: { id: 1, place: "Jebel Ali", price: 550 },
      error: null,
    });

    const request = new Request("http://localhost/api/pricing/transport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Place: "Jebel Ali", Price: 550 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      row: { id: 1, Place: "Jebel Ali", Price: 550 },
    });
  });

  it("returns 409 on duplicate place", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "transportation_charges_workspace_id_place_key"',
      },
    });

    const request = new Request("http://localhost/api/pricing/transport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Place: "Jebel Ali", Price: 550 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Transport charge for this place already exists",
    });
  });

  it("updates transport charge row", async () => {
    singleMock.mockResolvedValue({
      data: { id: 4, place: "Abu Dhabi", price: 680 },
      error: null,
    });

    const request = new Request("http://localhost/api/pricing/transport", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 4, Price: 680 }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("deletes transport charge row", async () => {
    mutationEqMock.mockImplementation(() => ({ eq: mutationEqMock, select: mutationSelectMock }));

    const request = new Request("http://localhost/api/pricing/transport", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 9 }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
