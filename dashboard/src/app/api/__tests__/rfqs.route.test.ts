import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const { createClientMock, orderMock, masterIsMock, shipmentInMock, containerInMock } = vi.hoisted(
  () => {
    const orderMock = vi.fn();
    const masterIsMock = vi.fn(() => ({ order: orderMock }));

    const missingRelationResponse = {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table" },
    };
    const shipmentInMock = vi.fn(() => Promise.resolve(missingRelationResponse));
    const containerInMock = vi.fn(() => Promise.resolve(missingRelationResponse));

    const createClientMock = vi.fn();

    return {
      createClientMock,
      orderMock,
      masterIsMock,
      shipmentInMock,
      containerInMock,
    };
  }
);

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { GET } from "@/app/api/rfqs/route";

describe("/api/rfqs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createClientMock.mockResolvedValue({
      from: (table: string) => {
        if (table === "master_rfqs") {
          return {
            select: () => ({
              eq: () => ({
                is: masterIsMock,
              }),
            }),
          };
        }

        if (table === "rfq_shipments") {
          return {
            select: () => ({
              eq: () => ({
                in: shipmentInMock,
              }),
            }),
          };
        }

        if (table === "rfq_shipment_containers") {
          return {
            select: () => ({
              eq: () => ({
                in: containerInMock,
              }),
            }),
          };
        }

        return {
          select: vi.fn(),
        };
      },
    });

    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "member" },
    });
  });

  it("filters out soft deleted RFQs and keeps legacy fallback working", async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          rfq_id: "RFQ-1",
          thread_id: "t1",
          customer_email: "ops@example.com",
          status: "Processing",
          pol: "SHENZHEN",
          pod: "JEBEL ALI",
          container_type: "40HQ",
          qty: "1",
          ready_date: "2026-03-01",
          delivery_deadline: null,
          service_type: "port-to-port",
          pickup_address: null,
          delivery_address: null,
          received_at: "2026-02-20T00:00:00.000Z",
          selected_agent: null,
          final_price_usd: null,
          final_price_aed: null,
          quoted_at: null,
          deleted_at: null,
        },
      ],
      error: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toHaveLength(1);
    expect(masterIsMock).toHaveBeenCalledWith("deleted_at", null);
    expect(payload[0].shipment_count).toBe(1);
    expect(shipmentInMock).toHaveBeenCalledOnce();
    expect(containerInMock).toHaveBeenCalledOnce();
  });
});
