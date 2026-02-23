import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { GET } from "@/app/api/dashboard/summary/route";
import { clearDashboardSummaryCache } from "@/lib/dashboard-summary";

type SupabaseMockConfig = {
  metricsRows?: Array<Record<string, unknown>>;
  recentRows?: Array<Record<string, unknown>>;
  normalizedQuoteRows?: Array<Record<string, unknown>>;
  legacyQuoteRows?: Array<Record<string, unknown>>;
  shipmentRows?: Array<Record<string, unknown>>;
  containerRows?: Array<Record<string, unknown>>;
  shipmentError?: { code: string; message: string } | null;
  containerError?: { code: string; message: string } | null;
};

function recentRow(overrides: Record<string, unknown> = {}) {
  return {
    rfq_id: "RFQ-1",
    thread_id: "thread-1",
    customer_email: "ops@example.com",
    status: "Processing",
    pol: "SHANGHAI",
    pod: "JEBEL ALI",
    container_type: "40HQ",
    qty: "1",
    ready_date: "2026-03-01",
    delivery_deadline: null,
    service_type: "port-to-port",
    pickup_address: null,
    delivery_address: null,
    received_at: "2026-02-22T10:00:00.000Z",
    selected_agent: null,
    final_price_usd: null,
    final_price_aed: null,
    quoted_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function createSupabaseMock(config: SupabaseMockConfig = {}) {
  return {
    from: (table: string) => {
      if (table === "master_rfqs") {
        return {
          select: (query: string) => {
            if (query.includes("status, quoted_at, received_at")) {
              return {
                eq: () => ({
                  is: () =>
                    Promise.resolve({ data: config.metricsRows || [], error: null }),
                }),
              };
            }

            return {
              eq: () => ({
                is: () => ({
                  order: () => ({
                    limit: () =>
                      Promise.resolve({ data: config.recentRows || [], error: null }),
                  }),
                }),
              }),
            };
          },
        };
      }

      if (table === "agent_quotes") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () =>
                  Promise.resolve({ data: config.normalizedQuoteRows || [], error: null }),
              }),
            }),
          }),
        };
      }

      if (table === "agent_outbound_log") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => Promise.resolve({ data: config.legacyQuoteRows || [], error: null }),
              }),
            }),
          }),
        };
      }

      if (table === "rfq_shipments") {
        return {
          select: () => ({
            eq: () => ({
              in: () =>
                Promise.resolve({
                  data: config.shipmentRows || [],
                  error: config.shipmentError || null,
                }),
            }),
          }),
        };
      }

      if (table === "rfq_shipment_containers") {
        return {
          select: () => ({
            eq: () => ({
              in: () =>
                Promise.resolve({
                  data: config.containerRows || [],
                  error: config.containerError || null,
                }),
            }),
          }),
        };
      }

      return { select: vi.fn() };
    },
  };
}

describe("/api/dashboard/summary route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDashboardSummaryCache();

    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "member" },
    });
  });

  it("returns dashboard summary for a valid workspace", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        metricsRows: [{ rfq_id: "RFQ-1", status: "Processing", quoted_at: null, received_at: "2026-02-22T10:00:00.000Z" }],
        recentRows: [recentRow()],
      })
    );

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.kpis.activeRFQs).toBe(1);
    expect(payload.pipeline).toEqual([{ status: "Processing", count: 1 }]);
    expect(payload.recentRfqs).toHaveLength(1);
    expect(payload.activity).toHaveLength(1);
  });

  it("returns unauthorized from workspace context guard", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 409 when no workspace is configured", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({});

    const response = await GET();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Workspace not configured",
    });
  });

  it("returns empty summary for workspaces without RFQs", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        metricsRows: [],
        recentRows: [],
      })
    );

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.kpis).toEqual({
      activeRFQs: 0,
      awaitingQuotes: 0,
      pendingSelection: 0,
      quotedToday: 0,
      avgResponseTimeHours: null,
    });
    expect(payload.pipeline).toEqual([]);
    expect(payload.activity).toEqual([]);
    expect(payload.recentRfqs).toEqual([]);
  });

  it("deduplicates received quotes when computing awaiting and pending KPIs", async () => {
    const today = new Date().toISOString();

    createClientMock.mockResolvedValue(
      createSupabaseMock({
        metricsRows: [
          { rfq_id: "RFQ-1", status: "Processing", quoted_at: null, received_at: "2026-02-22T09:00:00.000Z" },
          { rfq_id: "RFQ-2", status: "Processing", quoted_at: null, received_at: "2026-02-22T09:30:00.000Z" },
          { rfq_id: "RFQ-3", status: "Processing", quoted_at: null, received_at: "2026-02-22T10:00:00.000Z" },
          { rfq_id: "RFQ-4", status: "Quoted", quoted_at: today, received_at: "2026-02-22T10:15:00.000Z" },
        ],
        recentRows: [recentRow({ rfq_id: "RFQ-1" }), recentRow({ rfq_id: "RFQ-2" })],
        normalizedQuoteRows: [
          { rfq_id: "RFQ-1", match: "M-1", agent_email: "a@example.com", shipment_number: 1 },
          { rfq_id: "RFQ-1", match: "M-2", agent_email: "b@example.com", shipment_number: 1 },
          { rfq_id: "RFQ-2", match: "M-3", agent_email: "c@example.com", shipment_number: 1 },
        ],
        legacyQuoteRows: [
          { rfq_id: "RFQ-1", match: "M-1", agent_email: "a@example.com", shipment_number: 1 },
          { rfq_id: "RFQ-2", match: "M-3", agent_email: "c@example.com", shipment_number: 1 },
          { rfq_id: "RFQ-2", match: "M-4", agent_email: "d@example.com", shipment_number: 1 },
        ],
      })
    );

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.kpis.activeRFQs).toBe(3);
    expect(payload.kpis.awaitingQuotes).toBe(2);
    expect(payload.kpis.pendingSelection).toBe(2);
    expect(payload.kpis.quotedToday).toBe(1);
  });

  it("falls back to legacy shipment parsing when normalized tables are missing", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        metricsRows: [{ rfq_id: "RFQ-LEGACY", status: "Processing", quoted_at: null, received_at: "2026-02-22T10:00:00.000Z" }],
        recentRows: [
          recentRow({
            rfq_id: "RFQ-LEGACY",
            pol: "NINGBO",
            pod: "JEBEL ALI",
            container_type: "20FT",
            qty: "2",
          }),
        ],
        shipmentError: { code: "PGRST205", message: "Could not find the table" },
        containerError: { code: "PGRST205", message: "Could not find the table" },
      })
    );

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.recentRfqs).toHaveLength(1);
    expect(payload.recentRfqs[0].shipment_count).toBe(1);
    expect(payload.recentRfqs[0].pol).toBe("NINGBO");
    expect(payload.recentRfqs[0].pod).toBe("JEBEL ALI");
  });
});
