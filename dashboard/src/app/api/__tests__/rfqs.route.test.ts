import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const {
  createClientMock,
  fromMock,
  isMock,
  orderMock,
} = vi.hoisted(() => {
  const orderMock = vi.fn();
  const isMock = vi.fn(() => ({ order: orderMock }));
  const eqMock = vi.fn(() => ({ is: isMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  const createClientMock = vi.fn();

  return {
    createClientMock,
    fromMock,
    isMock,
    orderMock,
  };
});

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
    createClientMock.mockResolvedValue({ from: fromMock });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "member" },
    });
    orderMock.mockResolvedValue({ data: [], error: null });
  });

  it("filters out soft deleted RFQs", async () => {
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
    await expect(response.json()).resolves.toHaveLength(1);
    expect(isMock).toHaveBeenCalledWith("deleted_at", null);
  });
});
