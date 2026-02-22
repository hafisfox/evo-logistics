import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectAgentMock, getSettingsMock } = vi.hoisted(() => ({
  selectAgentMock: vi.fn(),
  getSettingsMock: vi.fn(),
}));

const { requireWorkspaceApiContextMock } = vi.hoisted(() => ({
  requireWorkspaceApiContextMock: vi.fn(),
}));

vi.mock("@/lib/modal-client", () => ({
  selectAgent: selectAgentMock,
}));

vi.mock("@/lib/settings", () => ({
  getSettings: getSettingsMock,
}));

vi.mock("@/lib/workspace-context", () => ({
  requireWorkspaceApiContext: requireWorkspaceApiContextMock,
}));

import { POST } from "@/app/api/rfqs/[rfqId]/select/route";

describe("/api/rfqs/[rfqId]/select route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceApiContextMock.mockResolvedValue({
      context: { workspaceId: "ws-1", userId: "user-1", role: "member" },
    });
  });

  it("rejects invalid payload", async () => {
    const request = new Request("http://localhost/api/rfqs/RFQ-1/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selected_agent: "Alpha Logistics",
        selected_carrier: "COSCO",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ rfqId: "RFQ-1" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid select-agent payload");
    expect(selectAgentMock).not.toHaveBeenCalled();
  });

  it("calls webhook with validated defaults", async () => {
    getSettingsMock.mockResolvedValue({ profitMargin: 15, quoteThreshold: 3 });
    selectAgentMock.mockResolvedValue({ success: true, rfq_id: "RFQ-1" });

    const request = new Request("http://localhost/api/rfqs/RFQ-1/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selected_agent: "Alpha Logistics",
        selected_carrier: "COSCO",
        selected_match: "RFQ-1_agent@example.com_1_COSCO_ab12cd34",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ rfqId: "RFQ-1" }),
    });

    expect(response.status).toBe(200);
    expect(selectAgentMock).toHaveBeenCalledWith({
      rfq_id: "RFQ-1",
      workspace_id: "ws-1",
      selected_by_user_id: "user-1",
      selected_agent: "Alpha Logistics",
      selected_carrier: "COSCO",
      selected_match: "RFQ-1_agent@example.com_1_COSCO_ab12cd34",
      shipment_number: "1",
      selected_by: "user-1",
      margin: 0.15,
      quote_threshold: 3,
    });

    await expect(response.json()).resolves.toEqual({ success: true, rfq_id: "RFQ-1" });
  });

  it("returns unauthorized without workspace context", async () => {
    requireWorkspaceApiContextMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const request = new Request("http://localhost/api/rfqs/RFQ-1/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selected_agent: "Alpha Logistics",
        selected_carrier: "COSCO",
        selected_match: "RFQ-1_agent@example.com_1_COSCO_ab12cd34",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ rfqId: "RFQ-1" }),
    });

    expect(response.status).toBe(401);
    expect(selectAgentMock).not.toHaveBeenCalled();
  });
});
