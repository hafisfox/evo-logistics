export interface DOCharge {
  id?: number;
  carrier: string;
  document: number;
  "20FT": number;
  "40FT": number;
  "40HQ": number;
}

export interface DestinationCharge {
  id?: number;
  "Charge Type": string;
  Basis: string;
  "20FT": number;
  "40FT": number;
}

export interface TransportCharge {
  id?: number;
  Place: string;
  Price: number;
}

export interface SurchargeBreakdown {
  BAF: number;
  CAF: number;
  THC: number;
  PSS: number;
  GRI: number;
  ISPS: number;
  ORC: number;
  war_risk: number;
  congestion: number;
  other: number;
  total: number;
}

export interface ShipmentCost {
  shipmentNumber: number;
  serviceType: string;
  pol: string;
  pod: string;
  containerType: string;
  qty: number;
  carrier: string;
  oceanFreightUSD: number;
  oceanFreightAED: number;
  surchargesUSD: number;
  surchargesAED: number;
  surchargeBreakdown: SurchargeBreakdown | null;
  doDocument: number;
  doPerContainer: number;
  doTotal: number;
  destTotal: number;
  transpPerContainer: number;
  transpTotal: number;
  subtotalAED: number;
  marginPercent: number;
  marginAmount: number;
  finalPriceAED: number;
  pricePerContainerAED: number;
  finalPriceUSD: number;
  pricePerContainerUSD: number;
  exchangeRate: number;
}

export interface PricingResult {
  shipments: ShipmentCost[];
  grandTotalAED: number;
  grandTotalUSD: number;
  exchangeRate: number;
  marginPercent: number;
}
