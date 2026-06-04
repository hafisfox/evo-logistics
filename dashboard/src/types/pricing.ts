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

export interface AirCarrierProfile {
  id?: number;
  iata_code: string;
  name: string;
  cargo_types: string;
  active: boolean;
}

export interface AirChargeRate {
  id?: number;
  carrier: string;
  origin: string;
  destination: string;
  min_weight_kg: number;
  rate_per_kg_usd: number;
  min_charge_usd: number;
}

export interface TruckCarrierProfile {
  id?: number;
  name: string;
  mc_number: string;
  dot_number: string;
  equipment_types: string;
  active: boolean;
}

export interface TruckLaneRate {
  id?: number;
  carrier: string;
  origin_zip: string;
  destination_zip: string;
  equipment_type: string;
  rate_per_mile_usd: number | null;
  flat_rate_usd: number | null;
  min_charge_usd: number;
  fuel_surcharge_pct: number;
}

export interface LtlFreightClass {
  id?: number;
  nmfc_class: string;
  description: string;
  min_density: number | null;
  max_density: number | null;
  rate_per_100lb_usd: number;
  min_charge_usd: number;
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
  // Air freight fields (present when freightMode === "air")
  ratePerKgUSD?: number;
  chargeableWeightKg?: number;
  airFreightUSD?: number;
  airFreightAED?: number;
}

export interface PricingResult {
  shipments: ShipmentCost[];
  grandTotalAED: number;
  grandTotalUSD: number;
  exchangeRate: number;
  marginPercent: number;
}
