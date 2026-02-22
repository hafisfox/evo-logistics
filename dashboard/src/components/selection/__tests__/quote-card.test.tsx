import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuoteCard } from "@/components/selection/quote-card";

const quote = {
  rfq_id: "RFQ-1",
  match: "RFQ-1_agent@x.com_1",
  agent_name: "Alpha Logistics",
  agent_email: "agent@example.com",
  shipment_number: "1",
  carrier: "COSCO",
  price: "1200",
  currency: "USD",
  etd: "2026-03-01",
  transit_time: "18",
  free_time: "7",
  validity: "2026-03-10",
  status: "Received",
  sent_at: "2026-02-20T00:00:00Z",
  received_at: "2026-02-20T01:00:00Z",
} as const;

describe("QuoteCard", () => {
  it("triggers selection from explicit button semantics", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <QuoteCard
        quote={quote}
        rank={1}
        isSelected={false}
        onSelect={onSelect}
      />
    );

    const button = screen.getByRole("button", {
      name: /select quote from alpha logistics on cosco/i,
    });

    await user.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard activation and selected state semantics", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <QuoteCard
        quote={quote}
        rank={1}
        isSelected={true}
        onSelect={onSelect}
      />
    );

    const button = screen.getByRole("button", {
      name: /selected quote from alpha logistics on cosco/i,
    });

    expect(button).toHaveAttribute("aria-pressed", "true");

    button.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
