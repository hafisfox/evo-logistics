import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  calculateFullPricingMock,
  getSettingsMock,
  createClientMock,
  requireWorkspaceApiContextMock,
} = vi.hoisted(() => ({
  calculateFullPricingMock: vi.fn(),
  getSettingsMock: vi.fn(),
  createClientMock: vi.fn(),
  requireWorkspaceApiContextMock: vi.fn(),
}));

vi.mock("@/lib/pricing-engine", () => ({
  calculateFullPricing: calculateFullPricingMock,
}));

vi.mock("@/lib/settings", () => ({
  getSettings: getSettingsMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

import { POST } from "@/app/api/pricing/calculate/route";

describe("/api/pricing/calculate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "user-1", role: "member" },
    });
  });

  it("rejects malformed payload", async () => {
    const request = new Request("http://localhost/api/pricing/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfq: { container_type: "20FT" } }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid pricing payload");
    expect(calculateFullPricingMock).not.toHaveBeenCalled();
  });

  it("calculates pricing for valid payload", async () => {
    const tableData = {
      do_charges: [{ carrier: "COSCO", document: 100, "20FT": 200, "40FT": 300, "40HQ": 350 }],
      destination_charges: [{ charge_type: "THC", basis: "Fixed", "20FT": 150, "40FT": 250 }],
      transportation_charges: [{ place: "DUBAI", price: 250 }],
    };

    createClientMock.mockResolvedValue({
      from: (table: keyof typeof tableData) => ({
        select: () => ({
          eq: () => Promise.resolve({ data: tableData[table], error: null }),
        }),
      }),
    });

    getSettingsMock.mockResolvedValue({ profitMargin: 13, quoteThreshold: 2 });
    calculateFullPricingMock.mockReturnValue({
      shipments: [],
      grandTotalAED: 1000,
      grandTotalUSD: 272,
    });

    const request = new Request("http://localhost/api/pricing/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rfq: {
          container_type: "20FT",
          qty: "1",
          pol: "SHANGHAI",
          pod: "JEBEL ALI",
          service_type: "port-to-door",
          delivery_address: "Dubai",
        },
        quote: {
          carrier: "COSCO",
          price: "800",
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(calculateFullPricingMock).toHaveBeenCalledTimes(1);
    const callArg = calculateFullPricingMock.mock.calls[0][0];
    expect(callArg.settings).toEqual({ margin: 0.13, quoteThreshold: 2 });
    expect(getSettingsMock).toHaveBeenCalledWith("ws-1");

    await expect(response.json()).resolves.toEqual({
      shipments: [],
      grandTotalAED: 1000,
      grandTotalUSD: 272,
    });
  });

  it("returns unauthorized when workspace context is missing", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const request = new Request("http://localhost/api/pricing/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(calculateFullPricingMock).not.toHaveBeenCalled();
  });
});
