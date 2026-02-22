import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RFQTable } from "@/components/rfqs/rfq-table";
import type { MasterRFQ } from "@/types/rfq";

const rfqs: MasterRFQ[] = [
  {
    rfq_id: "RFQ-20260222-001",
    thread_id: "thread-1",
    customer_email: "ops@example.com",
    status: "Processing",
    pol: "SHANGHAI",
    pod: "JEBEL ALI",
    container_type: "40HQ",
    qty: "1",
    ready_date: "2026-03-01",
    delivery_deadline: null,
    service_type: "port-to-door",
    pickup_address: null,
    delivery_address: "Dubai",
    received_at: "2026-02-22T10:00:00Z",
    selected_agent: null,
    final_price_usd: null,
    final_price_aed: null,
    quoted_at: null,
  },
];

describe("RFQTable", () => {
  it("adds accessible names to icon-only action controls", () => {
    render(<RFQTable rfqs={rfqs} />);

    expect(
      screen.getByRole("link", {
        name: /view rfq rfq-20260222-001/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: /select agent for rfq rfq-20260222-001/i,
      })
    ).toBeInTheDocument();
  });
});
