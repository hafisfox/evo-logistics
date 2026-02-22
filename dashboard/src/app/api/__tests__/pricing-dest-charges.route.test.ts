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

import { DELETE, GET, PATCH, POST } from "@/app/api/pricing/dest-charges/route";

describe("/api/pricing/dest-charges route", () => {
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
      data: [
        { id: 7, charge_type: "THC", basis: "per container", "20FT": 100, "40FT": 200 },
      ],
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: 7,
        "Charge Type": "THC",
        Basis: "per container",
        "20FT": 100,
        "40FT": 200,
      },
    ]);
  });

  it("creates destination charge row", async () => {
    singleMock.mockResolvedValue({
      data: { id: 1, charge_type: "THC", basis: "per container", "20FT": 100, "40FT": 200 },
      error: null,
    });

    const request = new Request("http://localhost/api/pricing/dest-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "Charge Type": "THC",
        Basis: "per container",
        "20FT": 100,
        "40FT": 200,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      row: {
        id: 1,
        "Charge Type": "THC",
        Basis: "per container",
      },
    });
  });

  it("updates destination charge row", async () => {
    singleMock.mockResolvedValue({
      data: { id: 2, charge_type: "Delivery", basis: "flat", "20FT": 40, "40FT": 60 },
      error: null,
    });

    const request = new Request("http://localhost/api/pricing/dest-charges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 2, Basis: "flat" }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("returns 404 on missing destination charge row", async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: "PGRST116", message: "No rows" } });

    const request = new Request("http://localhost/api/pricing/dest-charges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 999, Basis: "flat" }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Destination charge row not found",
    });
  });

  it("deletes destination charge row", async () => {
    mutationEqMock.mockImplementation(() => ({ eq: mutationEqMock, select: mutationSelectMock }));

    const request = new Request("http://localhost/api/pricing/dest-charges", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 8 }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
