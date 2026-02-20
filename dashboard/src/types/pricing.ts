export interface DOCharge {
  carrier: string;
  document: number;
  "20FT": number;
  "40FT": number;
  "40HQ": number;
}

export interface DestinationCharge {
  "Charge Type": string;
  Basis: string;
  "20FT": number;
  "40FT": number;
}

export interface TransportCharge {
  Place: string;
  Price: number;
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
  doDocument: number;
  doPerContainer: number;
  doTotal: number;
  destTotal: number;
  transpPerContainer: number;
  transpTotal: number;
  subtotalAED: number;
  marginAmount: number;
  finalPriceAED: number;
  pricePerContainerAED: number;
  finalPriceUSD: number;
  pricePerContainerUSD: number;
}

export interface PricingResult {
  shipments: ShipmentCost[];
  grandTotalAED: number;
  grandTotalUSD: number;
}
