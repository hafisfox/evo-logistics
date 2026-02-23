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
  selected_match: string;
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
    shipments?: Array<{
      shipment_number: number;
      pol: string;
      pod: string;
      service_type: string;
      ready_date: string | null;
      delivery_deadline: string | null;
      pickup_address: string | null;
      delivery_address: string | null;
      containers: Array<{
        container_type: string;
        qty: number;
      }>;
    }>;
  };
  quote: {
    carrier: string;
    price: string;
  };
}

export interface AgentCreateBody {
  agent_name: string;
  email: string;
  status: "active" | "inactive";
}

export interface AgentUpdateBody {
  current_agent_name: string;
  agent_name?: string;
  email?: string;
  status?: "active" | "inactive";
}

export interface AgentDeleteBody {
  agent_name: string;
}

export interface DOChargeCreateBody {
  carrier: string;
  document: number;
  "20FT": number;
  "40FT": number;
  "40HQ": number;
}

export interface DOChargeUpdateBody {
  id: number;
  carrier?: string;
  document?: number;
  "20FT"?: number;
  "40FT"?: number;
  "40HQ"?: number;
}

export interface DestinationChargeCreateBody {
  charge_type: string;
  basis: string;
  "20FT": number;
  "40FT": number;
}

export interface DestinationChargeUpdateBody {
  id: number;
  charge_type?: string;
  basis?: string;
  "20FT"?: number;
  "40FT"?: number;
}

export interface TransportChargeCreateBody {
  place: string;
  price: number;
}

export interface TransportChargeUpdateBody {
  id: number;
  place?: string;
  price?: number;
}

export interface IdDeleteBody {
  id: number;
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

const AGENT_STATUSES = new Set(["active", "inactive"]);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function asStringOrNull(value: unknown): string | null {
  if (!isNonEmptyString(value)) return null;
  return value.trim();
}

function parseRequiredNumber(
  value: unknown,
  field: string,
  details: string[]
): number | null {
  const parsed = asNumber(value);
  if (parsed == null) {
    details.push(`${field} must be a finite number.`);
    return null;
  }
  return parsed;
}

function parseOptionalNumber(
  value: unknown,
  field: string,
  details: string[]
): number | undefined {
  if (value == null) return undefined;
  const parsed = asNumber(value);
  if (parsed == null) {
    details.push(`${field} must be a finite number when provided.`);
    return undefined;
  }
  return parsed;
}

function parseRequiredId(
  value: unknown,
  entityLabel: string,
  details: string[]
): number | null {
  const parsed = asNumber(value);
  if (parsed == null || !Number.isInteger(parsed) || parsed <= 0) {
    details.push(`${entityLabel} id must be a positive integer.`);
    return null;
  }
  return parsed;
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

  if (!isNonEmptyString(body.selected_match)) {
    details.push("selected_match is required.");
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
      selected_match: String(body.selected_match).trim(),
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

  const rawShipments = Array.isArray(rfq.shipments) ? rfq.shipments : null;
  const hasShipments = !!rawShipments && rawShipments.length > 0;

  if (!hasShipments && !isNonEmptyString(rfq.container_type)) {
    details.push("rfq.container_type is required.");
  }

  if (!hasShipments && !isNonEmptyString(rfq.qty)) {
    details.push("rfq.qty is required.");
  }

  if (!hasShipments && !isNonEmptyString(rfq.pol)) {
    details.push("rfq.pol is required.");
  }

  if (!hasShipments && !isNonEmptyString(rfq.pod)) {
    details.push("rfq.pod is required.");
  }

  if (!isNonEmptyString(rfq.service_type) || !VALID_SERVICE_TYPES.has(rfq.service_type.trim())) {
    details.push("rfq.service_type must be one of: port-to-port, door-to-port, port-to-door, door-to-door.");
  }

  if (!(typeof rfq.delivery_address === "string" || rfq.delivery_address === null)) {
    details.push("rfq.delivery_address must be a string or null.");
  }

  const normalizedShipments: PricingCalculateBody["rfq"]["shipments"] = [];
  if (rawShipments) {
    for (let index = 0; index < rawShipments.length; index += 1) {
      const shipment = rawShipments[index];
      if (!isRecord(shipment)) {
        details.push(`rfq.shipments[${index}] must be an object.`);
        continue;
      }

      if (!isNonEmptyString(shipment.pol)) {
        details.push(`rfq.shipments[${index}].pol is required.`);
      }
      if (!isNonEmptyString(shipment.pod)) {
        details.push(`rfq.shipments[${index}].pod is required.`);
      }

      const shipmentServiceType = isNonEmptyString(shipment.service_type)
        ? shipment.service_type.trim()
        : "";
      if (!VALID_SERVICE_TYPES.has(shipmentServiceType)) {
        details.push(
          `rfq.shipments[${index}].service_type must be one of: port-to-port, door-to-port, port-to-door, door-to-door.`
        );
      }

      const shipmentContainers = Array.isArray(shipment.containers) ? shipment.containers : [];
      if (shipmentContainers.length === 0) {
        details.push(`rfq.shipments[${index}].containers must contain at least one item.`);
      }

      const normalizedContainers: Array<{ container_type: string; qty: number }> = [];
      for (let cIndex = 0; cIndex < shipmentContainers.length; cIndex += 1) {
        const container = shipmentContainers[cIndex];
        if (!isRecord(container)) {
          details.push(`rfq.shipments[${index}].containers[${cIndex}] must be an object.`);
          continue;
        }

        const containerType = isNonEmptyString(container.container_type)
          ? container.container_type.trim()
          : "";
        if (!containerType) {
          details.push(`rfq.shipments[${index}].containers[${cIndex}].container_type is required.`);
        }

        const qty = asNumber(container.qty);
        if (qty == null || !Number.isInteger(qty) || qty <= 0) {
          details.push(
            `rfq.shipments[${index}].containers[${cIndex}].qty must be a positive integer.`
          );
        }

        if (containerType && qty != null && Number.isInteger(qty) && qty > 0) {
          normalizedContainers.push({
            container_type: containerType,
            qty,
          });
        }
      }

      if (
        isNonEmptyString(shipment.pol) &&
        isNonEmptyString(shipment.pod) &&
        VALID_SERVICE_TYPES.has(shipmentServiceType) &&
        normalizedContainers.length > 0
      ) {
        normalizedShipments.push({
          shipment_number: Number.isInteger(asNumber(shipment.shipment_number))
            ? Number(shipment.shipment_number)
            : index + 1,
          pol: shipment.pol.trim(),
          pod: shipment.pod.trim(),
          service_type: shipmentServiceType,
          ready_date:
            typeof shipment.ready_date === "string" && shipment.ready_date.trim().length > 0
              ? shipment.ready_date.trim()
              : null,
          delivery_deadline:
            typeof shipment.delivery_deadline === "string" &&
            shipment.delivery_deadline.trim().length > 0
              ? shipment.delivery_deadline.trim()
              : null,
          pickup_address:
            typeof shipment.pickup_address === "string" &&
            shipment.pickup_address.trim().length > 0
              ? shipment.pickup_address.trim()
              : null,
          delivery_address:
            typeof shipment.delivery_address === "string" &&
            shipment.delivery_address.trim().length > 0
              ? shipment.delivery_address.trim()
              : null,
          containers: normalizedContainers,
        });
      }
    }
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
        shipments: normalizedShipments.length > 0 ? normalizedShipments : undefined,
      },
      quote: {
        carrier,
        price,
      },
    },
  };
}

export function validateAgentCreateBody(body: unknown): ValidationResult<AgentCreateBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid agent payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];

  const agentName = asStringOrNull(body.agent_name);
  if (!agentName) {
    details.push("agent_name is required.");
  }

  const rawEmail = asStringOrNull(body.email);
  const email = rawEmail?.toLowerCase() ?? null;
  if (!email) {
    details.push("email is required.");
  } else if (!EMAIL_REGEX.test(email)) {
    details.push("email must be a valid email address.");
  }

  const status =
    typeof body.status === "string" && AGENT_STATUSES.has(body.status)
      ? (body.status as "active" | "inactive")
      : body.status == null
        ? "active"
        : null;
  if (status == null) {
    details.push("status must be active or inactive when provided.");
  }

  if (details.length > 0 || !agentName || !email || !status) {
    return {
      success: false,
      error: "Invalid agent payload",
      details,
    };
  }

  return {
    success: true,
    data: {
      agent_name: agentName,
      email,
      status,
    },
  };
}

export function validateAgentUpdateBody(body: unknown): ValidationResult<AgentUpdateBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid agent payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const currentAgentName = asStringOrNull(body.current_agent_name);
  if (!currentAgentName) {
    details.push("current_agent_name is required.");
  }

  const updates: Omit<AgentUpdateBody, "current_agent_name"> = {};

  if ("agent_name" in body) {
    const nextAgentName = asStringOrNull(body.agent_name);
    if (!nextAgentName) {
      details.push("agent_name must be a non-empty string when provided.");
    } else {
      updates.agent_name = nextAgentName;
    }
  }

  if ("email" in body) {
    const nextEmail = asStringOrNull(body.email)?.toLowerCase() ?? null;
    if (!nextEmail) {
      details.push("email must be a non-empty string when provided.");
    } else if (!EMAIL_REGEX.test(nextEmail)) {
      details.push("email must be a valid email address.");
    } else {
      updates.email = nextEmail;
    }
  }

  if ("status" in body) {
    if (
      typeof body.status !== "string" ||
      !AGENT_STATUSES.has(body.status)
    ) {
      details.push("status must be active or inactive when provided.");
    } else {
      updates.status = body.status as "active" | "inactive";
    }
  }

  if (Object.keys(updates).length === 0) {
    details.push("At least one updatable field is required.");
  }

  if (details.length > 0 || !currentAgentName) {
    return {
      success: false,
      error: "Invalid agent payload",
      details,
    };
  }

  return {
    success: true,
    data: {
      current_agent_name: currentAgentName,
      ...updates,
    },
  };
}

export function validateAgentDeleteBody(body: unknown): ValidationResult<AgentDeleteBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid agent payload",
      details: ["Body must be a JSON object."],
    };
  }

  const agentName = asStringOrNull(body.agent_name);
  if (!agentName) {
    return {
      success: false,
      error: "Invalid agent payload",
      details: ["agent_name is required."],
    };
  }

  return {
    success: true,
    data: { agent_name: agentName },
  };
}

export function validateDOChargeCreateBody(body: unknown): ValidationResult<DOChargeCreateBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid DO charges payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const carrier = asStringOrNull(body.carrier);
  if (!carrier) {
    details.push("carrier is required.");
  }

  const document = parseRequiredNumber(body.document, "document", details);
  const c20 = parseRequiredNumber(body["20FT"], "20FT", details);
  const c40 = parseRequiredNumber(body["40FT"], "40FT", details);
  const c40hq = parseRequiredNumber(body["40HQ"], "40HQ", details);

  if (details.length > 0 || !carrier || document == null || c20 == null || c40 == null || c40hq == null) {
    return {
      success: false,
      error: "Invalid DO charges payload",
      details,
    };
  }

  return {
    success: true,
    data: {
      carrier,
      document,
      "20FT": c20,
      "40FT": c40,
      "40HQ": c40hq,
    },
  };
}

export function validateDOChargeUpdateBody(body: unknown): ValidationResult<DOChargeUpdateBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid DO charges payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const id = parseRequiredId(body.id, "DO charge", details);
  const updates: Omit<DOChargeUpdateBody, "id"> = {};

  if ("carrier" in body) {
    const carrier = asStringOrNull(body.carrier);
    if (!carrier) {
      details.push("carrier must be a non-empty string when provided.");
    } else {
      updates.carrier = carrier;
    }
  }

  const document = "document" in body
    ? parseOptionalNumber(body.document, "document", details)
    : undefined;
  if (document != null) updates.document = document;

  const c20 = "20FT" in body
    ? parseOptionalNumber(body["20FT"], "20FT", details)
    : undefined;
  if (c20 != null) updates["20FT"] = c20;

  const c40 = "40FT" in body
    ? parseOptionalNumber(body["40FT"], "40FT", details)
    : undefined;
  if (c40 != null) updates["40FT"] = c40;

  const c40hq = "40HQ" in body
    ? parseOptionalNumber(body["40HQ"], "40HQ", details)
    : undefined;
  if (c40hq != null) updates["40HQ"] = c40hq;

  if (Object.keys(updates).length === 0) {
    details.push("At least one updatable field is required.");
  }

  if (details.length > 0 || id == null) {
    return {
      success: false,
      error: "Invalid DO charges payload",
      details,
    };
  }

  return {
    success: true,
    data: { id, ...updates },
  };
}

export function validateDestinationChargeCreateBody(
  body: unknown
): ValidationResult<DestinationChargeCreateBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid destination charges payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const chargeType = asStringOrNull(body["Charge Type"]);
  if (!chargeType) {
    details.push("Charge Type is required.");
  }

  const basis = asStringOrNull(body.Basis);
  if (!basis) {
    details.push("Basis is required.");
  }

  const c20 = parseRequiredNumber(body["20FT"], "20FT", details);
  const c40 = parseRequiredNumber(body["40FT"], "40FT", details);

  if (details.length > 0 || !chargeType || !basis || c20 == null || c40 == null) {
    return {
      success: false,
      error: "Invalid destination charges payload",
      details,
    };
  }

  return {
    success: true,
    data: {
      charge_type: chargeType,
      basis,
      "20FT": c20,
      "40FT": c40,
    },
  };
}

export function validateDestinationChargeUpdateBody(
  body: unknown
): ValidationResult<DestinationChargeUpdateBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid destination charges payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const id = parseRequiredId(body.id, "Destination charge", details);
  const updates: Omit<DestinationChargeUpdateBody, "id"> = {};

  if ("Charge Type" in body) {
    const chargeType = asStringOrNull(body["Charge Type"]);
    if (!chargeType) {
      details.push("Charge Type must be a non-empty string when provided.");
    } else {
      updates.charge_type = chargeType;
    }
  }

  if ("Basis" in body) {
    const basis = asStringOrNull(body.Basis);
    if (!basis) {
      details.push("Basis must be a non-empty string when provided.");
    } else {
      updates.basis = basis;
    }
  }

  const c20 = "20FT" in body
    ? parseOptionalNumber(body["20FT"], "20FT", details)
    : undefined;
  if (c20 != null) updates["20FT"] = c20;

  const c40 = "40FT" in body
    ? parseOptionalNumber(body["40FT"], "40FT", details)
    : undefined;
  if (c40 != null) updates["40FT"] = c40;

  if (Object.keys(updates).length === 0) {
    details.push("At least one updatable field is required.");
  }

  if (details.length > 0 || id == null) {
    return {
      success: false,
      error: "Invalid destination charges payload",
      details,
    };
  }

  return {
    success: true,
    data: {
      id,
      ...updates,
    },
  };
}

export function validateTransportChargeCreateBody(
  body: unknown
): ValidationResult<TransportChargeCreateBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid transport charges payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const place = asStringOrNull(body.Place);
  if (!place) {
    details.push("Place is required.");
  }
  const price = parseRequiredNumber(body.Price, "Price", details);

  if (details.length > 0 || !place || price == null) {
    return {
      success: false,
      error: "Invalid transport charges payload",
      details,
    };
  }

  return {
    success: true,
    data: {
      place,
      price,
    },
  };
}

export function validateTransportChargeUpdateBody(
  body: unknown
): ValidationResult<TransportChargeUpdateBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: "Invalid transport charges payload",
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const id = parseRequiredId(body.id, "Transport charge", details);
  const updates: Omit<TransportChargeUpdateBody, "id"> = {};

  if ("Place" in body) {
    const place = asStringOrNull(body.Place);
    if (!place) {
      details.push("Place must be a non-empty string when provided.");
    } else {
      updates.place = place;
    }
  }

  if ("Price" in body) {
    const price = parseOptionalNumber(body.Price, "Price", details);
    if (price != null) {
      updates.price = price;
    }
  }

  if (Object.keys(updates).length === 0) {
    details.push("At least one updatable field is required.");
  }

  if (details.length > 0 || id == null) {
    return {
      success: false,
      error: "Invalid transport charges payload",
      details,
    };
  }

  return {
    success: true,
    data: {
      id,
      ...updates,
    },
  };
}

export function validateIdDeleteBody(
  body: unknown,
  entityLabel: string
): ValidationResult<IdDeleteBody> {
  if (!isRecord(body)) {
    return {
      success: false,
      error: `Invalid ${entityLabel} payload`,
      details: ["Body must be a JSON object."],
    };
  }

  const details: string[] = [];
  const id = parseRequiredId(body.id, entityLabel, details);
  if (details.length > 0 || id == null) {
    return {
      success: false,
      error: `Invalid ${entityLabel} payload`,
      details,
    };
  }

  return {
    success: true,
    data: { id },
  };
}
