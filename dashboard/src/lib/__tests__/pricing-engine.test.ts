import { describe, expect, it } from "vitest";
import {
  calculateAirPrice,
  calculateFullPricing,
  calculatePortPrice,
  calculateLandPrice,
  calculateFtlPrice,
  calculateLtlPrice,
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

describe("calculateAirPrice", () => {
  const settings = { margin: 0.13, quoteThreshold: 2 };

  it("prices by chargeable weight × per-kg rate, then margin + 10 AED rounding", () => {
    const ratePerKgUSD = 4;
    const chargeableWeightKg = 250;
    const result = calculateAirPrice({ ratePerKgUSD, chargeableWeightKg, settings });

    const airFreightAED = ratePerKgUSD * chargeableWeightKg * EXCHANGE_RATE;
    const expectedAED = Math.ceil((airFreightAED * 1.13) / 10) * 10;
    const expectedUSD = Math.ceil(expectedAED / EXCHANGE_RATE);

    expect(result.airFreightUSD).toBe(1000);
    expect(result.finalPriceAED).toBe(expectedAED);
    expect(result.finalPriceUSD).toBe(expectedUSD);
    expect(result.chargeableWeightKg).toBe(250);
  });

  it("adds surcharges to the base before applying margin", () => {
    const base = calculateAirPrice({ ratePerKgUSD: 3, chargeableWeightKg: 100, settings });
    const withSurcharges = calculateAirPrice({
      ratePerKgUSD: 3,
      chargeableWeightKg: 100,
      settings,
      surchargesUSD: 200,
    });

    expect(withSurcharges.finalPriceAED).toBeGreaterThan(base.finalPriceAED);
    expect(withSurcharges.surchargesUSD).toBe(200);
  });

  it("respects a custom exchange rate", () => {
    const result = calculateAirPrice({
      ratePerKgUSD: 5,
      chargeableWeightKg: 100,
      settings: { ...settings, exchangeRate: 3.7 },
    });

    expect(result.exchangeRate).toBe(3.7);
    expect(result.airFreightAED).toBe(Math.round(5 * 100 * 3.7 * 100) / 100);
  });
});

describe("calculateLandPrice", () => {
  const settings = { margin: 0.13, quoteThreshold: 2 };

  it("prices the quoted land total then margin + 10 AED rounding", () => {
    const landFreightUSD = 1500;
    const result = calculateLandPrice(landFreightUSD, settings);

    const landFreightAED = landFreightUSD * EXCHANGE_RATE;
    const expectedAED = Math.ceil((landFreightAED * 1.13) / 10) * 10;
    const expectedUSD = Math.ceil(expectedAED / EXCHANGE_RATE);

    expect(result.landFreightUSD).toBe(1500);
    expect(result.finalPriceAED).toBe(expectedAED);
    expect(result.finalPriceUSD).toBe(expectedUSD);
  });

  it("adds surcharges before margin", () => {
    const base = calculateLandPrice(1000, settings);
    const withSurcharges = calculateLandPrice(1000, settings, 250);
    expect(withSurcharges.finalPriceAED).toBeGreaterThan(base.finalPriceAED);
    expect(withSurcharges.surchargesUSD).toBe(250);
  });
});

describe("calculateFtlPrice", () => {
  const settings = { margin: 0.13, quoteThreshold: 2 };

  it("prices per-mile × distance + fuel surcharge", () => {
    const result = calculateFtlPrice({
      settings,
      ratePerMileUSD: 2.5,
      distanceMiles: 1000,
      fuelSurchargePct: 20,
    });
    // linehaul 2500, fuel 500 => land freight 3000
    expect(result.linehaulUSD).toBe(2500);
    expect(result.fuelSurchargeUSD).toBe(500);
    expect(result.landFreightUSD).toBe(3000);
    expect(result.loadType).toBe("FTL");
  });

  it("uses a flat rate when provided and floors at the min charge", () => {
    const result = calculateFtlPrice({ settings, flatRateUSD: 100, minChargeUSD: 800 });
    expect(result.linehaulUSD).toBe(800);
  });

  it("throws when neither flat nor per-mile rate is given", () => {
    expect(() => calculateFtlPrice({ settings })).toThrow();
  });
});

describe("calculateLtlPrice", () => {
  const settings = { margin: 0.13, quoteThreshold: 2 };

  it("prices class rate × (weight / 100) + fuel", () => {
    const result = calculateLtlPrice({
      ratePer100lbUSD: 30,
      weightLbs: 2000,
      settings,
      fuelSurchargePct: 10,
    });
    // linehaul 30 × 20 = 600, fuel 60 => 660
    expect(result.linehaulUSD).toBe(600);
    expect(result.fuelSurchargeUSD).toBe(60);
    expect(result.landFreightUSD).toBe(660);
    expect(result.loadType).toBe("LTL");
  });

  it("floors the linehaul at the min charge", () => {
    const result = calculateLtlPrice({
      ratePer100lbUSD: 10,
      weightLbs: 100,
      settings,
      minChargeUSD: 150,
    });
    expect(result.linehaulUSD).toBe(150);
  });

  it("throws on non-positive weight", () => {
    expect(() => calculateLtlPrice({ ratePer100lbUSD: 30, weightLbs: 0, settings })).toThrow();
  });
});
