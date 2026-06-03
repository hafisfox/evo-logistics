import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const { createClientMock, fromSpy, setListResult, setSingleResult } = vi.hoisted(() => {
  let listResult: { data: unknown; error: unknown } = { data: [], error: null };
  let singleResult: { data: unknown; error: unknown } = { data: null, error: null };
  // A chain that supports .select/.eq/.order/.insert/.update/.delete and is awaitable.
  // Awaiting the chain resolves the "list" result; .single() resolves the "single" result.
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

import { DELETE, GET, PATCH, POST } from "@/app/api/pricing/air-carriers/route";

function postBody(body: unknown) {
  return new Request("http://localhost/api/pricing/air-carriers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/pricing/air-carriers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromSpy });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });
    setListResult({ data: [], error: null });
    setSingleResult({ data: null, error: null });
  });

  it("maps GET rows with coerced booleans", async () => {
    setListResult({
      data: [{ id: 3, iata_code: "EK", name: "Emirates SkyCargo", cargo_types: "general", active: true }],
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: 3, iata_code: "EK", name: "Emirates SkyCargo", cargo_types: "general", active: true },
    ]);
  });

  it("returns an empty list when the table is missing (pre-migration)", async () => {
    setListResult({ data: null, error: { code: "PGRST205", message: "Could not find the table" } });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("creates an airline and uppercases the IATA code", async () => {
    setSingleResult({
      data: { id: 1, iata_code: "EK", name: "Emirates", cargo_types: "general", active: true },
      error: null,
    });

    const response = await POST(postBody({ iata_code: "ek", name: "Emirates", cargo_types: "general" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      row: { id: 1, iata_code: "EK", active: true },
    });
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await POST(postBody({ name: "Emirates" }));
    expect(response.status).toBe(400);
  });

  it("returns 409 on duplicate IATA code", async () => {
    setSingleResult({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const response = await POST(postBody({ iata_code: "EK", name: "Emirates" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Air carrier with this IATA code already exists",
    });
  });

  it("deletes an airline", async () => {
    setListResult({ data: [], error: null });
    const request = new Request("http://localhost/api/pricing/air-carriers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 9 }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("rejects writes from members at the API layer", async () => {
    // owner/admin only — the route passes allowedRoles to requireWorkspaceApiContext,
    // which returns a response for unauthorized roles.
    requireWorkspaceApiContextMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/pricing/air-carriers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 1, name: "x" }),
      })
    );
    expect(response.status).toBe(403);
  });
});
