import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

const {
  createClientMock,
  fromMock,
  masterIsMock,
  quotesEqRfqMock,
  deleteUpdateMock,
  deleteSingleMock,
} = vi.hoisted(() => {
  const masterSingleMock = vi.fn();
  const masterIsMock = vi.fn(() => ({ single: masterSingleMock }));
  const masterEqRfqMock = vi.fn(() => ({ is: masterIsMock, single: masterSingleMock }));
  const masterEqWorkspaceMock = vi.fn(() => ({ eq: masterEqRfqMock, is: masterIsMock, single: masterSingleMock }));
  const masterSelectMock = vi.fn(() => ({ eq: masterEqWorkspaceMock }));

  const quotesEqRfqMock = vi.fn();
  const quotesEqWorkspaceMock = vi.fn(() => ({ eq: quotesEqRfqMock }));
  const quotesSelectMock = vi.fn(() => ({ eq: quotesEqWorkspaceMock }));

  const deleteSingleMock = vi.fn();
  const deleteSelectMock = vi.fn(() => ({ single: deleteSingleMock }));
  const deleteIsMock = vi.fn(() => ({ select: deleteSelectMock }));
  const deleteEqRfqMock = vi.fn(() => ({ is: deleteIsMock }));
  const deleteEqWorkspaceMock = vi.fn(() => ({ eq: deleteEqRfqMock }));
  const deleteUpdateMock = vi.fn(() => ({ eq: deleteEqWorkspaceMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === "master_rfqs") {
      return {
        select: masterSelectMock,
        update: deleteUpdateMock,
      };
    }

    return {
      select: quotesSelectMock,
    };
  });

  const createClientMock = vi.fn();

  return {
    createClientMock,
    fromMock,
    masterIsMock,
    quotesEqRfqMock,
    deleteUpdateMock,
    deleteSingleMock,
  };
});

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { DELETE, GET } from "@/app/api/rfqs/[rfqId]/route";

describe("/api/rfqs/[rfqId] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({ from: fromMock });
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "u-1", role: "owner" },
    });

    quotesEqRfqMock.mockResolvedValue({ data: [], error: null });
  });

  it("GET excludes soft-deleted RFQ records", async () => {
    masterIsMock.mockReturnValueOnce({
      single: vi.fn().mockResolvedValue({
        data: {
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
        error: null,
      }),
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ rfqId: "RFQ-1" }),
    });

    expect(response.status).toBe(200);
    expect(masterIsMock).toHaveBeenCalledWith("deleted_at", null);
  });

  it("DELETE soft-deletes an RFQ", async () => {
    deleteSingleMock.mockResolvedValue({
      data: {
        rfq_id: "RFQ-1",
        deleted_at: "2026-02-22T12:00:00.000Z",
      },
      error: null,
    });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ rfqId: "RFQ-1" }),
    });

    expect(response.status).toBe(200);
    expect(deleteUpdateMock).toHaveBeenCalled();
    const payload = (deleteUpdateMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(payload).toBeDefined();
    expect(payload?.deleted_at).toBeTypeOf("string");

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      rfq_id: "RFQ-1",
      deleted_at: "2026-02-22T12:00:00.000Z",
    });
  });

  it("DELETE returns 404 when RFQ does not exist or already deleted", async () => {
    deleteSingleMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ rfqId: "RFQ-missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "RFQ not found" });
  });
});
