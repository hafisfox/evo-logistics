import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const { createClientMock, fromSpy, setListResult, setSingleResult } = vi.hoisted(() => {
  let listResult: { data: unknown; error: unknown } = { data: [], error: null };
  let singleResult: { data: unknown; error: unknown } = { data: null, error: null };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.insert = () => chain;
  chain.update = () => chain;
  chain.delete = () => chain;
  chain.single = () => Promise.resolve(singleResult);
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject);
  const fromSpy = vi.fn(() => chain);
  const createClientMock = vi.fn();
  return {
    createClientMock,
    fromSpy,
    setListResult: (r: { data: unknown; error: unknown }) => {
      listResult = r;
    },
    setSingleResult: (r: { data: unknown; error: unknown }) => {
      singleResult = r;
    },
  };
});

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { DELETE, GET, POST } from "@/app/api/pricing/land-carriers/route";

function postBody(body: unknown) {
  return new Request("http://localhost/api/pricing/land-carriers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/pricing/land-carriers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromSpy });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });
    setListResult({ data: [], error: null });
    setSingleResult({ data: null, error: null });
  });

  it("maps GET rows", async () => {
    setListResult({
      data: [
        { id: 2, name: "HAUL PRO", mc_number: "MC123", dot_number: "DOT456", equipment_types: "dry van, reefer", active: true },
      ],
      error: null,
    });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: 2, name: "HAUL PRO", mc_number: "MC123", dot_number: "DOT456", equipment_types: "dry van, reefer", active: true },
    ]);
  });

  it("creates a carrier", async () => {
    setSingleResult({
      data: { id: 1, name: "HAUL PRO", mc_number: "", dot_number: "", equipment_types: "", active: true },
      error: null,
    });
    const response = await POST(postBody({ name: "Haul Pro" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, row: { id: 1, name: "HAUL PRO" } });
  });

  it("returns 400 when name is missing", async () => {
    const response = await POST(postBody({ mc_number: "MC1" }));
    expect(response.status).toBe(400);
  });

  it("returns 409 on duplicate name", async () => {
    setSingleResult({ data: null, error: { code: "23505", message: "duplicate key value" } });
    const response = await POST(postBody({ name: "Haul Pro" }));
    expect(response.status).toBe(409);
  });

  it("deletes a carrier", async () => {
    setListResult({ data: [], error: null });
    const request = new Request("http://localhost/api/pricing/land-carriers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 4 }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
