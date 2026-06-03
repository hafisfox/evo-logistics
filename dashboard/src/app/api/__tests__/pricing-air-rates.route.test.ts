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

import { DELETE, GET, POST } from "@/app/api/pricing/air-rates/route";

function postBody(body: unknown) {
  return new Request("http://localhost/api/pricing/air-rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/pricing/air-rates route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromSpy });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });
    setListResult({ data: [], error: null });
    setSingleResult({ data: null, error: null });
  });

  it("maps GET rows with coerced numbers", async () => {
    setListResult({
      data: [
        {
          id: 5,
          carrier: "EK",
          origin: "DXB",
          destination: "LHR",
          min_weight_kg: 100,
          rate_per_kg_usd: 3.85,
          min_charge_usd: 75,
        },
      ],
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: 5,
        carrier: "EK",
        origin: "DXB",
        destination: "LHR",
        min_weight_kg: 100,
        rate_per_kg_usd: 3.85,
        min_charge_usd: 75,
      },
    ]);
  });

  it("creates a rate and uppercases lane fields", async () => {
    setSingleResult({
      data: {
        id: 1,
        carrier: "EK",
        origin: "DXB",
        destination: "LHR",
        min_weight_kg: 100,
        rate_per_kg_usd: 3.85,
        min_charge_usd: 75,
      },
      error: null,
    });

    const response = await POST(
      postBody({
        carrier: "ek",
        origin: "dxb",
        destination: "lhr",
        min_weight_kg: 100,
        rate_per_kg_usd: 3.85,
        min_charge_usd: 75,
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      row: { id: 1, carrier: "EK", origin: "DXB", destination: "LHR" },
    });
  });

  it("returns 400 when rate_per_kg_usd is not positive", async () => {
    const response = await POST(
      postBody({ carrier: "EK", origin: "DXB", destination: "LHR", min_weight_kg: 0, rate_per_kg_usd: 0, min_charge_usd: 0 })
    );
    expect(response.status).toBe(400);
  });

  it("returns 409 on duplicate lane tier", async () => {
    setSingleResult({ data: null, error: { code: "23505", message: "duplicate key value" } });

    const response = await POST(
      postBody({ carrier: "EK", origin: "DXB", destination: "LHR", min_weight_kg: 100, rate_per_kg_usd: 3.85, min_charge_usd: 75 })
    );
    expect(response.status).toBe(409);
  });

  it("deletes a rate", async () => {
    setListResult({ data: [], error: null });
    const request = new Request("http://localhost/api/pricing/air-rates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 7 }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
