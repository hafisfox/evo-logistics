import type { DOCharge, DestinationCharge, TransportCharge, ShipmentCost, PricingResult } from "@/types/pricing";

const USD_TO_AED = 3.685;
const MARGIN = 0.13;

export function parseMultiValue(value: string | null | undefined): string[] {
  if (!value) return ["N/A"];
  if (typeof value === "string" && value.includes("\n"))
    return value.split("\n").map((v) => v.trim());
  return [value];
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

export function calculatePortPrice(
  oceanFreightUSD: number,
  qty: number
): { finalPriceAED: number; finalPriceUSD: number; marginAmount: number; oceanFreightAED: number } {
  const oceanFreightAED = oceanFreightUSD * USD_TO_AED;
  const withMargin = oceanFreightAED * (1 + MARGIN);
  const finalPriceAED = Math.ceil(withMargin / 10) * 10;
  const finalPriceUSD =
    Math.round((finalPriceAED / USD_TO_AED) * 100) / 100;
  const marginAmount =
    Math.round((withMargin - oceanFreightAED) * 100) / 100;
  return { finalPriceAED, finalPriceUSD, marginAmount, oceanFreightAED: Math.round(oceanFreightAED * 100) / 100 };
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
  } = params;

  const doCol = getDOCol(containerType);
  const destCol = getDestCol(containerType);
  const oceanFreightAED = oceanFreightUSD * USD_TO_AED;

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
  const subtotalAED = oceanFreightAED + doTotal + destTotal + transpTotal;
  const withMargin = subtotalAED * (1 + MARGIN);
  const finalPriceAED = Math.ceil(withMargin / 10) * 10;
  const pricePerContainerAED = Math.round(finalPriceAED / qty);
  const finalPriceUSD =
    Math.round((finalPriceAED / USD_TO_AED) * 100) / 100;
  const pricePerContainerUSD =
    Math.round((finalPriceUSD / qty) * 100) / 100;

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
    doDocument,
    doPerContainer,
    doTotal: Math.round(doTotal * 100) / 100,
    destTotal: Math.round(destTotal * 100) / 100,
    transpPerContainer,
    transpTotal: Math.round(transpTotal * 100) / 100,
    subtotalAED: Math.round(subtotalAED * 100) / 100,
    marginAmount: Math.round((withMargin - subtotalAED) * 100) / 100,
    finalPriceAED,
    pricePerContainerAED,
    finalPriceUSD,
    pricePerContainerUSD,
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
  };
  quote: {
    carrier: string;
    price: string;
  };
  doCharges: DOCharge[];
  destCharges: DestinationCharge[];
  transpCharges: TransportCharge[];
}): PricingResult {
  const { rfq, quote, doCharges, destCharges, transpCharges } = params;

  const containerTypes = parseMultiValue(rfq.container_type);
  const quantities = parseMultiValue(rfq.qty);
  const pols = parseMultiValue(rfq.pol);
  const pods = parseMultiValue(rfq.pod);
  const carriers = parseMultiValue(quote.carrier);
  const prices = parseMultiValue(quote.price);

  const serviceType = (rfq.service_type || "port-to-port").toLowerCase().trim();
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
    const qty = parseInt(quantities[i] || quantities[0] || "1");
    const carrier = carriers[i] || carriers[0] || "TBD";
    const oceanFreightUSD = parseFloat(prices[i] || prices[0] || "0");
    const pol = pols[i] || pols[0] || "N/A";
    const pod = pods[i] || pods[0] || "N/A";

    if (isPortOnly) {
      const portResult = calculatePortPrice(oceanFreightUSD, qty);
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
        doDocument: 0,
        doPerContainer: 0,
        doTotal: 0,
        destTotal: 0,
        transpPerContainer: 0,
        transpTotal: 0,
        subtotalAED: portResult.oceanFreightAED,
        marginAmount: portResult.marginAmount,
        finalPriceAED: portResult.finalPriceAED,
        pricePerContainerAED: Math.round(portResult.finalPriceAED / qty),
        finalPriceUSD: portResult.finalPriceUSD,
        pricePerContainerUSD: Math.round((portResult.finalPriceUSD / qty) * 100) / 100,
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
        deliveryAddress: hasDelivery ? rfq.delivery_address : null,
        doCharges,
        destCharges,
        transpCharges,
      });
      doorResult.shipmentNumber = i + 1;
      doorResult.serviceType = serviceType;
      doorResult.pol = pol;
      doorResult.pod = pod;
      shipments.push(doorResult);
      grandTotalAED += doorResult.finalPriceAED;
      grandTotalUSD += doorResult.finalPriceUSD;
    }
  }

  return {
    shipments,
    grandTotalAED,
    grandTotalUSD: Math.round(grandTotalUSD * 100) / 100,
  };
}
