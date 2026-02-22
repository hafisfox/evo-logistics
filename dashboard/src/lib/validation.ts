import type { Settings } from "@/lib/settings";

export interface ApiErrorPayload {
  error: string;
  details?: string[];
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details: string[] };

export interface SelectAgentBody {
  selected_agent: string;
  selected_carrier: string;
  shipment_number?: string;
  selected_by?: string;
}

export interface PricingCalculateBody {
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function validateSettingsUpdateBody(body: unknown): ValidationResult<Partial<Settings>> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid settings payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const updates: Partial<Settings> = {};

  if ("profitMargin" in body) {
    const margin = asNumber(body.profitMargin);
    if (margin == null) {
      details.push("profitMargin must be a finite number.");
    } else if (margin < 0 || margin > 50) {
      details.push("profitMargin must be between 0 and 50.");
    } else {
      updates.profitMargin = margin;
    }
  }

  if ("quoteThreshold" in body) {
    const threshold = asNumber(body.quoteThreshold);
    if (threshold == null) {
      details.push("quoteThreshold must be a finite number.");
    } else if (!Number.isInteger(threshold) || threshold < 1 || threshold > 10) {
      details.push("quoteThreshold must be an integer between 1 and 10.");
    } else {
      updates.quoteThreshold = threshold;
    }
  }

  if (Object.keys(updates).length === 0 && details.length === 0) {
    details.push("At least one setting key is required: profitMargin or quoteThreshold.");
  }

  if (details.length > 0) {
    return {
      success: false,
      error: "Invalid settings payload",
      details,
    };
  }

  return { success: true, data: updates };
}

export function validateSelectAgentBody(body: unknown): ValidationResult<SelectAgentBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid select-agent payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];

  if (!isNonEmptyString(body.selected_agent)) {
    details.push("selected_agent is required.");
  }

  if (!isNonEmptyString(body.selected_carrier)) {
    details.push("selected_carrier is required.");
  }

  if ("shipment_number" in body && body.shipment_number != null && !isNonEmptyString(body.shipment_number)) {
    details.push("shipment_number must be a non-empty string when provided.");
  }

  if ("selected_by" in body && body.selected_by != null && !isNonEmptyString(body.selected_by)) {
    details.push("selected_by must be a non-empty string when provided.");
  }

  if (details.length > 0) {
    return {
      success: false,
      error: "Invalid select-agent payload",
      details,
    };
  }

  return {
    success: true,
    data: {
      selected_agent: String(body.selected_agent).trim(),
      selected_carrier: String(body.selected_carrier).trim(),
      shipment_number: isNonEmptyString(body.shipment_number)
        ? body.shipment_number.trim()
        : undefined,
      selected_by: isNonEmptyString(body.selected_by)
        ? body.selected_by.trim()
        : undefined,
    },
  };
}

const VALID_SERVICE_TYPES = new Set([
  "port-to-port",
  "door-to-port",
  "port-to-door",
  "door-to-door",
]);

export function validatePricingCalculateBody(body: unknown): ValidationResult<PricingCalculateBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid pricing payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const rfq = isRecord(body.rfq) ? body.rfq : null;
  const quote = isRecord(body.quote) ? body.quote : null;

  if (!rfq) {
    details.push("rfq object is required.");
  }

  if (!quote) {
    details.push("quote object is required.");
  }

  if (!rfq || !quote) {
    return { success: false, error: "Invalid pricing payload", details };
  }

  if (!isNonEmptyString(rfq.container_type)) {
    details.push("rfq.container_type is required.");
  }

  if (!isNonEmptyString(rfq.qty)) {
    details.push("rfq.qty is required.");
  }

  if (!isNonEmptyString(rfq.pol)) {
    details.push("rfq.pol is required.");
  }

  if (!isNonEmptyString(rfq.pod)) {
    details.push("rfq.pod is required.");
  }

  if (!isNonEmptyString(rfq.service_type) || !VALID_SERVICE_TYPES.has(rfq.service_type.trim())) {
    details.push("rfq.service_type must be one of: port-to-port, door-to-port, port-to-door, door-to-door.");
  }

  if (!(typeof rfq.delivery_address === "string" || rfq.delivery_address === null)) {
    details.push("rfq.delivery_address must be a string or null.");
  }

  if (!isNonEmptyString(quote.carrier)) {
    details.push("quote.carrier is required.");
  }

  if (!isNonEmptyString(quote.price)) {
    details.push("quote.price is required.");
  }

  if (details.length > 0) {
    return {
      success: false,
      error: "Invalid pricing payload",
      details,
    };
  }

  const containerType = isNonEmptyString(rfq.container_type) ? rfq.container_type.trim() : "";
  const qty = isNonEmptyString(rfq.qty) ? rfq.qty.trim() : "";
  const pol = isNonEmptyString(rfq.pol) ? rfq.pol.trim() : "";
  const pod = isNonEmptyString(rfq.pod) ? rfq.pod.trim() : "";
  const serviceType = isNonEmptyString(rfq.service_type) ? rfq.service_type.trim() : "";
  const deliveryAddress =
    typeof rfq.delivery_address === "string" && rfq.delivery_address.trim().length > 0
      ? rfq.delivery_address.trim()
      : null;
  const carrier = isNonEmptyString(quote.carrier) ? quote.carrier.trim() : "";
  const price = isNonEmptyString(quote.price) ? quote.price.trim() : "";

  return {
    success: true,
    data: {
      rfq: {
        container_type: containerType,
        qty,
        pol,
        pod,
        service_type: serviceType,
        delivery_address: deliveryAddress,
      },
      quote: {
        carrier,
        price,
      },
    },
  };
}
