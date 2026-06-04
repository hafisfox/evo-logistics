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

import { DELETE, GET, POST } from "@/app/api/pricing/land-rates/route";

function postBody(body: unknown) {
  return new Request("http://localhost/api/pricing/land-rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/pricing/land-rates route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromSpy });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });
    setListResult({ data: [], error: null });
    setSingleResult({ data: null, error: null });
  });

  it("maps GET rows with nullable rates coerced", async () => {
    setListResult({
      data: [
        {
          id: 3,
          carrier: "HAULPRO",
          origin_zip: "90001",
          destination_zip: "60601",
          equipment_type: "DRY VAN",
          rate_per_mile_usd: 2.5,
          flat_rate_usd: null,
          min_charge_usd: 500,
          fuel_surcharge_pct: 20,
        },
      ],
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: 3,
        carrier: "HAULPRO",
        origin_zip: "90001",
        destination_zip: "60601",
        equipment_type: "DRY VAN",
        rate_per_mile_usd: 2.5,
        flat_rate_usd: null,
        min_charge_usd: 500,
        fuel_surcharge_pct: 20,
      },
    ]);
  });

  it("creates a lane rate and uppercases lane fields", async () => {
    setSingleResult({
      data: {
        id: 1,
        carrier: "HAULPRO",
        origin_zip: "90001",
        destination_zip: "60601",
        equipment_type: "DRY VAN",
        rate_per_mile_usd: 2.5,
        flat_rate_usd: null,
        min_charge_usd: 0,
        fuel_surcharge_pct: 0,
      },
      error: null,
    });

    const response = await POST(
      postBody({
        carrier: "haulpro",
        origin_zip: "90001",
        destination_zip: "60601",
        equipment_type: "dry van",
        rate_per_mile_usd: 2.5,
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      row: { id: 1, carrier: "HAULPRO", origin_zip: "90001" },
    });
  });

  it("returns 400 when neither per-mile nor flat rate is provided", async () => {
    const response = await POST(
      postBody({ carrier: "HAULPRO", origin_zip: "90001", destination_zip: "60601" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 409 on duplicate lane", async () => {
    setSingleResult({ data: null, error: { code: "23505", message: "duplicate key value" } });
    const response = await POST(
      postBody({ carrier: "HAULPRO", origin_zip: "90001", destination_zip: "60601", flat_rate_usd: 1500 })
    );
    expect(response.status).toBe(409);
  });

  it("degrades gracefully (empty list) if the table is missing", async () => {
    setListResult({ data: null, error: { code: "42P01", message: "relation does not exist" } });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("deletes a lane rate", async () => {
    setListResult({ data: [], error: null });
    const request = new Request("http://localhost/api/pricing/land-rates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 7 }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
