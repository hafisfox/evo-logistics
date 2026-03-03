import type {
  DOCharge,
  DestinationCharge,
  TransportCharge,
  ShipmentCost,
  PricingResult,
  SurchargeBreakdown,
} from "@/types/pricing";
import type { QuoteSurcharges } from "@/types/rfq";

export const DEFAULT_EXCHANGE_RATE = 3.685;

export interface PricingSettings {
  margin: number;
  quoteThreshold: number;
  exchangeRate?: number;
}

export const DEFAULT_SETTINGS: PricingSettings = {
  margin: 0.13,
  quoteThreshold: 2,
};

export function parseMultiValue(value: string | null | undefined): string[] {
  if (!value) return ["N/A"];
  if (typeof value === "string" && value.includes("\n"))
    return value.split("\n").map((v) => v.trim());
  return [value];
}

interface StructuredRFQShipment {
  shipment_number: number;
  pol: string;
  pod: string;
  service_type: string;
  pickup_address: string | null;
  delivery_address: string | null;
  containers: Array<{
    container_type: string;
    qty: number;
  }>;
}

function flattenStructuredShipments(shipments: StructuredRFQShipment[]) {
  const polLines: string[] = [];
  const podLines: string[] = [];
  const containerTypeLines: string[] = [];
  const qtyLines: string[] = [];
  let serviceType = "port-to-port";
  let deliveryAddress: string | null = null;

  for (const shipment of shipments) {
    if (shipment.service_type) {
      serviceType = shipment.service_type;
    }
    if (!deliveryAddress && shipment.delivery_address) {
      deliveryAddress = shipment.delivery_address;
    }

    const containers =
      shipment.containers && shipment.containers.length > 0
        ? shipment.containers
        : [{ container_type: "40HQ", qty: 1 }];

    for (const container of containers) {
      polLines.push(shipment.pol || "N/A");
      podLines.push(shipment.pod || "N/A");
      containerTypeLines.push(container.container_type || "40HQ");
      qtyLines.push(String(container.qty || 1));
    }
  }

  return {
    pol: polLines.join("\n"),
    pod: podLines.join("\n"),
    container_type: containerTypeLines.join("\n"),
    qty: qtyLines.join("\n"),
    service_type: serviceType,
    delivery_address: deliveryAddress,
  };
}

function parsePositiveInteger(value: string | undefined, fallback = 1): number {
  const parsed = Number.parseInt(value || String(fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function getDOCol(containerType: string): "20FT" | "40FT" | "40HQ" {
  const t = (containerType || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t === "20FT" || t === "20GP") return "20FT";
  if (t === "40FT" || t === "40GP") return "40FT";
  return "40HQ";
}

function getDestCol(containerType: string): "20FT" | "40FT" {
  const t = (containerType || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t === "20FT" || t === "20GP") return "20FT";
  return "40FT";
}

function getDOChargesRow(carrier: string, allDO: DOCharge[]): DOCharge | null {
  const c = (carrier || "").toUpperCase().trim();
  for (const row of allDO) {
    if ((row.carrier || "").toUpperCase().trim() === c) return row;
  }
  return allDO.length > 0 ? allDO[0] : null;
}

function calcDestCharges(
  allDest: DestinationCharge[],
  col: "20FT" | "40FT",
  qty: number
): number {
  let total = 0;
  for (const row of allDest) {
    const amount = parseFloat(String(row[col])) || 0;
    const basis = (row["Basis"] || "").toLowerCase();
    total += basis.includes("fixed") ? amount : amount * qty;
  }
  return total;
}

function getTransportCharge(
  deliveryAddress: string | null,
  allTransp: TransportCharge[]
): number {
  if (!deliveryAddress) return 0;
  const addr = deliveryAddress.toUpperCase();
  for (const row of allTransp) {
    const place = (row.Place || "").toUpperCase().trim();
    if (place && addr.includes(place)) {
      return parseFloat(String(row.Price)) || 0;
    }
  }
  return 0;
}

/** Sum surcharge values from a QuoteSurcharges object */
export function sumSurcharges(surcharges: QuoteSurcharges | null | undefined): number {
  if (!surcharges) return 0;
  let total = 0;
  for (const value of Object.values(surcharges)) {
    if (typeof value === "number" && value > 0) {
      total += value;
    }
  }
  return total;
}

/** Build detailed surcharge breakdown */
function buildSurchargeBreakdown(
  surcharges: QuoteSurcharges | null | undefined
): SurchargeBreakdown | null {
  if (!surcharges) return null;
  const breakdown: SurchargeBreakdown = {
    BAF: surcharges.BAF ?? 0,
    CAF: surcharges.CAF ?? 0,
    THC: surcharges.THC ?? 0,
    PSS: surcharges.PSS ?? 0,
    GRI: surcharges.GRI ?? 0,
    ISPS: surcharges.ISPS ?? 0,
    ORC: surcharges.ORC ?? 0,
    war_risk: surcharges.war_risk ?? 0,
    congestion: surcharges.congestion ?? 0,
    other: 0,
    total: 0,
  };
  // Sum known keys
  const knownKeys = new Set([
    "BAF", "CAF", "THC", "PSS", "GRI", "ISPS", "ORC", "war_risk", "congestion",
  ]);
  for (const [key, value] of Object.entries(surcharges)) {
    if (!knownKeys.has(key) && typeof value === "number" && value > 0) {
      breakdown.other += value;
    }
  }
  breakdown.total =
    breakdown.BAF + breakdown.CAF + breakdown.THC + breakdown.PSS +
    breakdown.GRI + breakdown.ISPS + breakdown.ORC + breakdown.war_risk +
    breakdown.congestion + breakdown.other;
  return breakdown.total > 0 ? breakdown : null;
}

export function calculatePortPrice(
  oceanFreightUSD: number,
  settings: PricingSettings,
  surchargesUSD = 0
): {
  finalPriceAED: number;
  finalPriceUSD: number;
  marginAmount: number;
  oceanFreightAED: number;
  surchargesAED: number;
  exchangeRate: number;
} {
  const fx = settings.exchangeRate ?? DEFAULT_EXCHANGE_RATE;
  const oceanFreightAED = oceanFreightUSD * fx;
  const surchargesAED = surchargesUSD * fx;
  const subtotalAED = oceanFreightAED + surchargesAED;
  const withMargin = subtotalAED * (1 + settings.margin);
  const finalPriceAED = Math.ceil(withMargin / 10) * 10;
  const finalPriceUSD = Math.ceil(finalPriceAED / fx);
  const marginAmount = Math.round((withMargin - subtotalAED) * 100) / 100;
  return {
    finalPriceAED,
    finalPriceUSD,
    marginAmount,
    oceanFreightAED: Math.round(oceanFreightAED * 100) / 100,
    surchargesAED: Math.round(surchargesAED * 100) / 100,
    exchangeRate: fx,
  };
}

export function calculateDoorPrice(params: {
  oceanFreightUSD: number;
  qty: number;
  containerType: string;
  carrier: string;
  deliveryAddress: string | null;
  doCharges: DOCharge[];
  destCharges: DestinationCharge[];
  transpCharges: TransportCharge[];
  settings: PricingSettings;
  surchargesUSD?: number;
}): ShipmentCost {
  const {
    oceanFreightUSD,
    qty,
    containerType,
    carrier,
    deliveryAddress,
    doCharges,
    destCharges,
    transpCharges,
    settings,
    surchargesUSD = 0,
  } = params;

  const fx = settings.exchangeRate ?? DEFAULT_EXCHANGE_RATE;
  const doCol = getDOCol(containerType);
  const destCol = getDestCol(containerType);
  const oceanFreightAED = oceanFreightUSD * fx;
  const surchargesAED = surchargesUSD * fx;

  // DO Charges
  const doRow = getDOChargesRow(carrier, doCharges);
  const doDocument = parseFloat(String(doRow?.document)) || 0;
  const doPerContainer = parseFloat(String(doRow?.[doCol])) || 0;
  const doTotal = doDocument + doPerContainer * qty;

  // Destination Charges
  const destTotal = calcDestCharges(destCharges, destCol, qty);

  // Transport
  const transpPerContainer = getTransportCharge(deliveryAddress, transpCharges);
  const transpTotal = transpPerContainer * qty;

  // Totals
  const subtotalAED = oceanFreightAED + surchargesAED + doTotal + destTotal + transpTotal;
  const withMargin = subtotalAED * (1 + settings.margin);
  const finalPriceAED = Math.ceil(withMargin / 10) * 10;
  const pricePerContainerAED = Math.round(finalPriceAED / qty);
  const finalPriceUSD = Math.ceil(finalPriceAED / fx);
  const pricePerContainerUSD = Math.ceil(finalPriceUSD / qty);

  return {
    shipmentNumber: 1,
    serviceType: "door",
    pol: "",
    pod: "",
    containerType,
    qty,
    carrier,
    oceanFreightUSD,
    oceanFreightAED: Math.round(oceanFreightAED * 100) / 100,
    surchargesUSD: Math.round(surchargesUSD * 100) / 100,
    surchargesAED: Math.round(surchargesAED * 100) / 100,
    surchargeBreakdown: null,
    doDocument,
    doPerContainer,
    doTotal: Math.round(doTotal * 100) / 100,
    destTotal: Math.round(destTotal * 100) / 100,
    transpPerContainer,
    transpTotal: Math.round(transpTotal * 100) / 100,
    subtotalAED: Math.round(subtotalAED * 100) / 100,
    marginPercent: settings.margin,
    marginAmount: Math.round((withMargin - subtotalAED) * 100) / 100,
    finalPriceAED,
    pricePerContainerAED,
    finalPriceUSD,
    pricePerContainerUSD,
    exchangeRate: fx,
  };
}

export function calculateFullPricing(params: {
  rfq: {
    container_type: string;
    qty: string;
    pol: string;
    pod: string;
    service_type: string;
    delivery_address: string | null;
    shipments?: StructuredRFQShipment[];
  };
  quote: {
    carrier: string;
    price: string;
    surcharges?: QuoteSurcharges | null;
  };
  doCharges: DOCharge[];
  destCharges: DestinationCharge[];
  transpCharges: TransportCharge[];
  settings: PricingSettings;
}): PricingResult {
  const { rfq, quote, doCharges, destCharges, transpCharges, settings } = params;
  const fx = settings.exchangeRate ?? DEFAULT_EXCHANGE_RATE;
  const rfqForCalculation =
    rfq.shipments && rfq.shipments.length > 0
      ? {
          ...rfq,
          ...flattenStructuredShipments(rfq.shipments),
        }
      : rfq;

  const containerTypes = parseMultiValue(rfqForCalculation.container_type);
  const quantities = parseMultiValue(rfqForCalculation.qty);
  const pols = parseMultiValue(rfqForCalculation.pol);
  const pods = parseMultiValue(rfqForCalculation.pod);
  const carriers = parseMultiValue(quote.carrier);
  const prices = parseMultiValue(quote.price);

  // Surcharges from quote
  const surchargesUSD = sumSurcharges(quote.surcharges);
  const surchargeBreakdown = buildSurchargeBreakdown(quote.surcharges);

  const serviceType = (rfqForCalculation.service_type || "port-to-port").toLowerCase().trim();
  const isPortOnly = serviceType === "port-to-port";
  const hasDelivery =
    serviceType === "port-to-door" || serviceType === "door-to-door";
  const shipmentCount = Math.max(
    containerTypes.length,
    quantities.length,
    prices.length
  );

  const shipments: ShipmentCost[] = [];
  let grandTotalAED = 0;
  let grandTotalUSD = 0;

  for (let i = 0; i < shipmentCount; i++) {
    const containerType = containerTypes[i] || containerTypes[0] || "40HQ";
    const qty = parsePositiveInteger(quantities[i] || quantities[0], 1);
    const carrier = carriers[i] || carriers[0] || "TBD";
    const oceanFreightUSD = parseFloat(prices[i] || prices[0] || "0");
    const pol = pols[i] || pols[0] || "N/A";
    const pod = pods[i] || pods[0] || "N/A";

    if (isPortOnly) {
      const portResult = calculatePortPrice(oceanFreightUSD, settings, surchargesUSD);
      const shipment: ShipmentCost = {
        shipmentNumber: i + 1,
        serviceType: "port-to-port",
        pol,
        pod,
        containerType,
        qty,
        carrier,
        oceanFreightUSD,
        oceanFreightAED: portResult.oceanFreightAED,
        surchargesUSD: Math.round(surchargesUSD * 100) / 100,
        surchargesAED: portResult.surchargesAED,
        surchargeBreakdown,
        doDocument: 0,
        doPerContainer: 0,
        doTotal: 0,
        destTotal: 0,
        transpPerContainer: 0,
        transpTotal: 0,
        subtotalAED: portResult.oceanFreightAED + portResult.surchargesAED,
        marginPercent: settings.margin,
        marginAmount: portResult.marginAmount,
        finalPriceAED: portResult.finalPriceAED,
        pricePerContainerAED: Math.round(portResult.finalPriceAED / qty),
        finalPriceUSD: portResult.finalPriceUSD,
        pricePerContainerUSD: Math.round((portResult.finalPriceUSD / qty) * 100) / 100,
        exchangeRate: fx,
      };
      shipments.push(shipment);
      grandTotalAED += shipment.finalPriceAED;
      grandTotalUSD += shipment.finalPriceUSD;
    } else {
      const doorResult = calculateDoorPrice({
        oceanFreightUSD,
        qty,
        containerType,
        carrier,
        deliveryAddress: hasDelivery ? rfqForCalculation.delivery_address : null,
        doCharges,
        destCharges,
        transpCharges,
        settings,
        surchargesUSD,
      });
      doorResult.shipmentNumber = i + 1;
      doorResult.serviceType = serviceType;
      doorResult.pol = pol;
      doorResult.pod = pod;
      doorResult.surchargeBreakdown = surchargeBreakdown;
      shipments.push(doorResult);
      grandTotalAED += doorResult.finalPriceAED;
      grandTotalUSD += doorResult.finalPriceUSD;
    }
  }

  return {
    shipments,
    grandTotalAED,
    grandTotalUSD: Math.round(grandTotalUSD * 100) / 100,
    exchangeRate: fx,
    marginPercent: settings.margin,
  };
}
