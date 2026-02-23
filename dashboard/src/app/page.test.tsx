import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useDashboardSummaryMock } = vi.hoisted(() => ({
  useDashboardSummaryMock: vi.fn(),
}));

vi.mock("@/hooks/use-dashboard-summary", () => ({
  useDashboardSummary: useDashboardSummaryMock,
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    return function DynamicShipmentsTable(props: unknown) {
      return <div data-testid="deferred-shipments">{JSON.stringify(props)}</div>;
    };
  },
}));

import DashboardPage from "@/app/page";

const summaryFixture = {
  kpis: {
    activeRFQs: 3,
    awaitingQuotes: 1,
    pendingSelection: 1,
    quotedToday: 2,
    avgResponseTimeHours: 2.4,
  },
  pipeline: [
    { status: "Processing", count: 3 },
    { status: "Quoted", count: 2 },
  ],
  activity: [
    {
      rfq_id: "RFQ-1",
      customer_email: "ops@example.com",
      status: "Processing",
      timestamp: "2026-02-23T10:00:00.000Z",
      route: "SHANGHAI → JEBEL ALI",
    },
  ],
  recentRfqs: [
    {
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
      received_at: "2026-02-23T09:00:00.000Z",
      selected_agent: null,
      final_price_usd: null,
      final_price_aed: null,
      quoted_at: null,
      shipment_count: 1,
    },
  ],
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a single dashboard summary query path", () => {
    useDashboardSummaryMock.mockReturnValue({
      data: summaryFixture,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />);

    expect(useDashboardSummaryMock).toHaveBeenCalledTimes(1);
  });

  it("shows fallback table skeleton while summary is loading", () => {
    useDashboardSummaryMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<DashboardPage />);

    expect(screen.getByTestId("shipments-table-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("deferred-shipments")).not.toBeInTheDocument();
  });

  it("renders deferred shipments table with summary RFQs when loaded", () => {
    useDashboardSummaryMock.mockReturnValue({
      data: summaryFixture,
      isLoading: false,
      isError: false,
    });

    render(<DashboardPage />);

    const deferred = screen.getByTestId("deferred-shipments");
    const props = JSON.parse(deferred.textContent || "{}");
    expect(props.disableLiveFetch).toBe(true);
    expect(props.initialRFQs).toHaveLength(1);
    expect(props.initialRFQs[0].rfq_id).toBe("RFQ-1");
  });

  it("shows error fallback when summary request fails", () => {
    useDashboardSummaryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<DashboardPage />);

    expect(
      screen.getByText("Unable to load recent RFQs right now.")
    ).toBeInTheDocument();
  });
});
