import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const { fetchMarketRatesMock } = vi.hoisted(() => ({
  fetchMarketRatesMock: vi.fn(),
}));

const { createClientMock, fromSpy, setListResult } = vi.hoisted(() => {
  let listResult: { data: unknown; error: unknown } = { data: [], error: null };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
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
  };
});

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/modal-client", () => ({
  fetchMarketRates: fetchMarketRatesMock,
}));

import { GET, POST } from "@/app/api/rates/market/route";

function postBody(body: unknown) {
  return new Request("http://localhost/api/rates/market", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/rates/market route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromSpy });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });
    setListResult({ data: [], error: null });
  });

  it("maps GET rows to ExternalRateQuote shape", async () => {
    setListResult({
      data: [
        {
          id: 5,
          provider: "dat",
          carrier: "DAT Spot Market",
          origin: "90001",
          destination: "60601",
          equipment_type: "VAN",
          price_usd: 2108.4,
          currency: "USD",
          transit_time_days: 2,
          valid_until: "2026-06-11",
          surcharges: [{ type: "FUEL", amount: 316.26 }],
          source: "api",
          freight_mode: "land",
          created_at: "2026-06-04T00:00:00Z",
        },
      ],
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: 5,
        provider: "dat",
        carrier: "DAT Spot Market",
        origin: "90001",
        destination: "60601",
        equipment_type: "VAN",
        price_usd: 2108.4,
        currency: "USD",
        transit_time_days: 2,
        valid_until: "2026-06-11",
        surcharges: [{ type: "FUEL", amount: 316.26 }],
        source: "api",
        freight_mode: "land",
        created_at: "2026-06-04T00:00:00Z",
      },
    ]);
  });

  it("degrades gracefully (empty list) if the table is missing", async () => {
    setListResult({ data: null, error: { code: "42P01", message: "relation does not exist" } });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("returns 400 when origin/destination are missing", async () => {
    const response = await POST(postBody({ origin: "90001" }));
    expect(response.status).toBe(400);
    expect(fetchMarketRatesMock).not.toHaveBeenCalled();
  });

  it("triggers the Modal aggregator and returns its result", async () => {
    fetchMarketRatesMock.mockResolvedValue({
      success: true,
      mode: "mock",
      count: 4,
      persisted: 4,
      rates: [],
    });
    const response = await POST(
      postBody({ origin: "90001", destination: "60601", equipment_type: "VAN" })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, count: 4 });
    expect(fetchMarketRatesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: "ws-1",
        origin: "90001",
        destination: "60601",
        equipment_type: "VAN",
      })
    );
  });

  it("returns 502 when the Modal call fails", async () => {
    fetchMarketRatesMock.mockRejectedValue(new Error("webhook down"));
    const response = await POST(postBody({ origin: "90001", destination: "60601" }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: "webhook down" });
  });
});
