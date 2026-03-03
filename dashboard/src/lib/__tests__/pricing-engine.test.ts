import { describe, expect, it } from "vitest";
import {
  calculateFullPricing,
  calculatePortPrice,
  DEFAULT_EXCHANGE_RATE,
} from "@/lib/pricing-engine";

const EXCHANGE_RATE = DEFAULT_EXCHANGE_RATE;

describe("pricing-engine", () => {
  const doCharges = [
    { carrier: "COSCO", document: 120, "20FT": 200, "40FT": 350, "40HQ": 400 },
  ];

  const destinationCharges = [
    { "Charge Type": "Terminal", Basis: "Fixed (per shipment)", "20FT": 300, "40FT": 450 },
    { "Charge Type": "Handling", Basis: "Per container", "20FT": 100, "40FT": 150 },
  ];

  const transportCharges = [{ Place: "DUBAI", Price: 250 }];

  it("applies margin and rounds port pricing to the next 10 AED", () => {
    const result = calculatePortPrice(1000, { margin: 0.13, quoteThreshold: 2 });

    const oceanFreightAED = 1000 * EXCHANGE_RATE;
    const expectedAED = Math.ceil((oceanFreightAED * 1.13) / 10) * 10;
    const expectedUSD = Math.ceil(expectedAED / EXCHANGE_RATE);

    expect(result.finalPriceAED).toBe(expectedAED);
    expect(result.finalPriceUSD).toBe(expectedUSD);
  });

  it("parses newline multi-shipment input and sums totals", () => {
    const result = calculateFullPricing({
      rfq: {
        container_type: "40HQ\n20FT",
        qty: "1\n2",
        pol: "SHANGHAI\nNINGBO",
        pod: "JEBEL ALI\nJEBEL ALI",
        service_type: "port-to-port",
        delivery_address: null,
      },
      quote: {
        carrier: "COSCO\nMAERSK",
        price: "500\n700",
      },
      doCharges,
      destCharges: destinationCharges,
      transpCharges: transportCharges,
      settings: { margin: 0.13, quoteThreshold: 2 },
    });

    expect(result.shipments).toHaveLength(2);
    expect(result.shipments[0]?.containerType).toBe("40HQ");
    expect(result.shipments[1]?.containerType).toBe("20FT");
    expect(result.grandTotalAED).toBe(
      result.shipments.reduce((sum, shipment) => sum + shipment.finalPriceAED, 0)
    );
  });

  it("falls back invalid or zero qty values to 1", () => {
    const result = calculateFullPricing({
      rfq: {
        container_type: "40HQ\n20FT",
        qty: "0\nnot-a-number",
        pol: "SHANGHAI\nNINGBO",
        pod: "JEBEL ALI\nJEBEL ALI",
        service_type: "port-to-port",
        delivery_address: null,
      },
      quote: {
        carrier: "COSCO\nMAERSK",
        price: "500\n700",
      },
      doCharges,
      destCharges: destinationCharges,
      transpCharges: transportCharges,
      settings: { margin: 0.13, quoteThreshold: 2 },
    });

    expect(result.shipments[0]?.qty).toBe(1);
    expect(result.shipments[1]?.qty).toBe(1);
    expect(Number.isFinite(result.shipments[0]?.pricePerContainerAED || 0)).toBe(true);
    expect(Number.isFinite(result.shipments[1]?.pricePerContainerAED || 0)).toBe(true);
  });

  it("calculates fixed and per-container destination charges for door pricing", () => {
    const result = calculateFullPricing({
      rfq: {
        container_type: "20FT",
        qty: "2",
        pol: "SHANGHAI",
        pod: "JEBEL ALI",
        service_type: "door-to-door",
        delivery_address: "Dubai Silicon Oasis",
      },
      quote: {
        carrier: "COSCO",
        price: "800",
      },
      doCharges,
      destCharges: destinationCharges,
      transpCharges: transportCharges,
      settings: { margin: 0.13, quoteThreshold: 2 },
    });

    const shipment = result.shipments[0];
    expect(shipment).toBeDefined();
    expect(shipment?.destTotal).toBe(500); // fixed 300 + (100 * qty 2)
    expect(shipment?.doTotal).toBe(520); // document 120 + (200 * qty 2)
    expect(shipment?.transpTotal).toBe(500); // 250 * qty 2
  });
});
