import type { FreightMode } from "@/types/rfq";

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

// Unified rate aggregator schema — parity with the Python NormalizedRate
// (automations/freight_apis/base.py). One rate quote normalized across sources
// (agent email, external API). See FUTURE_PLAN.md "Design Rate Aggregator interface".
export interface NormalizedRate {
  carrier: string;
  origin: string;
  destination: string;
  price: number;
  currency: string;
  transit_time_days: number | null;
  valid_until: string | null;
  freight_mode: FreightMode;
  surcharges: { type: string; amount: number }[];
  source: "agent_email" | "api";
  provider?: string;
  equipment_type?: string | null;
}

// A persisted row from external_rate_quotes (Phase 4 land-freight market rates).
export interface ExternalRateQuote {
  id: number;
  provider: string;
  carrier: string;
  origin: string;
  destination: string;
  equipment_type: string | null;
  price_usd: number;
  currency: string;
  transit_time_days: number | null;
  valid_until: string | null;
  surcharges: { type: string; amount: number }[];
  source: string;
  freight_mode: string;
  created_at: string | null;
}
