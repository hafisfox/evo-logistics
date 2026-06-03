import type {
  AgentQuote,
  FreightMode,
  MasterRFQ,
  QuoteSurcharges,
  FreeTimeDetails,
  RFQShipment,
  RFQShipmentContainer,
  ServiceType,
} from "@/types/rfq";

const DEFAULT_SHIPMENT_FIELDS = {
  commodity_description: null,
  hs_code: null,
  incoterms: null,
  is_dangerous_goods: false,
  dg_class: null,
  is_reefer: false,
  reefer_temperature: null,
  special_requirements: null,
  cargo_weight_kg: null,
  cargo_volume_cbm: null,
  freight_mode: "ocean" as FreightMode,
} as const;

function defaultFieldsForMode(mode: FreightMode) {
  return { ...DEFAULT_SHIPMENT_FIELDS, freight_mode: mode };
}

const VALID_SERVICE_TYPES = new Set<ServiceType>([
  "port-to-port",
  "door-to-port",
  "port-to-door",
  "door-to-door",
  // Air service types
  "airport-to-airport",
  "door-to-airport",
  "airport-to-door",
  // Land service types
  "terminal-to-terminal",
  "door-to-terminal",
  "terminal-to-door",
]);

export interface RFQShipmentRow {
  workspace_id: string;
  rfq_id: string;
  shipment_number: number | string;
  pol: string | null;
  pod: string | null;
  ready_date: string | null;
  delivery_deadline: string | null;
  service_type: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  freight_mode?: string | null;
}

export interface RFQShipmentContainerRow {
  workspace_id: string;
  rfq_id: string;
  shipment_number: number | string;
  line_number: number | string;
  container_type: string | null;
  qty: number | string | null;
}

function toLines(value: string | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function pickLine(lines: string[], index: number, fallback: string): string {
  if (index < lines.length && lines[index]) return lines[index];
  if (lines.length > 0 && lines[lines.length - 1]) return lines[lines.length - 1];
  return fallback;
}

function pickNullableLine(lines: string[], index: number): string | null {
  if (index < lines.length && lines[index]) return lines[index];
  if (lines.length > 0 && lines[lines.length - 1]) return lines[lines.length - 1];
  return null;
}

function toPositiveInt(value: number | string | null | undefined, fallback: number): number {
  if (typeof value === "number") {
    if (Number.isFinite(value) && value > 0) return Math.trunc(value);
    return fallback;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return fallback;
}

function normalizeContainerType(value: string | null | undefined): string {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/['"]/g, "");

  if (!normalized) return "40HQ";
  if (normalized === "20GP") return "20FT";
  if (normalized === "40GP") return "40FT";
  if (normalized === "40HC") return "40HQ";
  return normalized;
}

function normalizeServiceType(value: string | null | undefined): ServiceType {
  const normalized = String(value || "port-to-port").trim().toLowerCase();
  if (VALID_SERVICE_TYPES.has(normalized as ServiceType)) {
    return normalized as ServiceType;
  }
  return "port-to-port";
}

function normalizeDateLike(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  return trimmed;
}

function toNonEmptyOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildLegacyShipmentsFromRFQ(rfq: Partial<MasterRFQ>): RFQShipment[] {
  const pols = toLines(rfq.pol);
  const pods = toLines(rfq.pod);
  const containerTypes = toLines(rfq.container_type);
  const qtys = toLines(rfq.qty);
  const readyDates = toLines(rfq.ready_date);
  const deliveryDeadlines = toLines(rfq.delivery_deadline);
  const serviceTypes = toLines(rfq.service_type);
  const pickupAddresses = toLines(rfq.pickup_address);
  const deliveryAddresses = toLines(rfq.delivery_address);

  const lineCount = Math.max(
    pols.length,
    pods.length,
    containerTypes.length,
    qtys.length,
    readyDates.length,
    deliveryDeadlines.length,
    serviceTypes.length,
    pickupAddresses.length,
    deliveryAddresses.length,
    1
  );

  const shipments: RFQShipment[] = [];
  let current: RFQShipment | null = null;
  let previousGroupKey: string | null = null;

  for (let index = 0; index < lineCount; index += 1) {
    const pol = pickLine(pols, index, "TBD");
    const pod = pickLine(pods, index, "TBD");
    const serviceType = normalizeServiceType(
      pickLine(serviceTypes, index, rfq.service_type || "port-to-port")
    );
    const pickupAddress = toNonEmptyOrNull(pickNullableLine(pickupAddresses, index));
    const deliveryAddress = toNonEmptyOrNull(pickNullableLine(deliveryAddresses, index));

    const groupKey = `${pol}|${pod}|${serviceType}|${pickupAddress ?? ""}|${deliveryAddress ?? ""}`;
    if (!current || groupKey !== previousGroupKey) {
      current = {
        shipment_number: shipments.length + 1,
        pol,
        pod,
        ready_date: normalizeDateLike(pickNullableLine(readyDates, index)),
        delivery_deadline: normalizeDateLike(pickNullableLine(deliveryDeadlines, index)),
        service_type: serviceType,
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        containers: [],
        ...defaultFieldsForMode((rfq.freight_mode as FreightMode) || "ocean"),
      };
      shipments.push(current);
      previousGroupKey = groupKey;
    }

    current.containers.push({
      line_number: current.containers.length + 1,
      container_type: normalizeContainerType(pickLine(containerTypes, index, "40HQ")),
      qty: toPositiveInt(pickLine(qtys, index, "1"), 1),
    });
  }

  if (shipments.length === 0) {
    shipments.push({
      shipment_number: 1,
      pol: "TBD",
      pod: "TBD",
      ready_date: normalizeDateLike(rfq.ready_date),
      delivery_deadline: normalizeDateLike(rfq.delivery_deadline),
      service_type: normalizeServiceType(rfq.service_type),
      pickup_address: toNonEmptyOrNull(rfq.pickup_address),
      delivery_address: toNonEmptyOrNull(rfq.delivery_address),
      containers: [{ line_number: 1, container_type: "40HQ", qty: 1 }],
      ...defaultFieldsForMode((rfq.freight_mode as FreightMode) || "ocean"),
    });
  }

  return shipments;
}

function normalizeContainerRows(containers: RFQShipmentContainerRow[]): RFQShipmentContainer[] {
  const sorted = [...containers].sort(
    (a, b) =>
      toPositiveInt(a.shipment_number, 1) - toPositiveInt(b.shipment_number, 1) ||
      toPositiveInt(a.line_number, 1) - toPositiveInt(b.line_number, 1)
  );

  return sorted.map((container, index) => ({
    line_number: toPositiveInt(container.line_number, index + 1),
    container_type: normalizeContainerType(container.container_type),
    qty: toPositiveInt(container.qty, 1),
  }));
}

export function buildShipmentsByRfq(
  shipmentRows: RFQShipmentRow[],
  containerRows: RFQShipmentContainerRow[]
): Map<string, RFQShipment[]> {
  const containerMap = new Map<string, RFQShipmentContainerRow[]>();

  for (const row of containerRows) {
    const shipmentNumber = toPositiveInt(row.shipment_number, 1);
    const key = `${row.rfq_id}::${shipmentNumber}`;
    const existing = containerMap.get(key) || [];
    existing.push(row);
    containerMap.set(key, existing);
  }

  const sortedShipments = [...shipmentRows].sort(
    (a, b) =>
      (a.rfq_id || "").localeCompare(b.rfq_id || "") ||
      toPositiveInt(a.shipment_number, 1) - toPositiveInt(b.shipment_number, 1)
  );

  const byRfq = new Map<string, RFQShipment[]>();

  for (const row of sortedShipments) {
    const shipmentNumber = toPositiveInt(row.shipment_number, 1);
    const containerKey = `${row.rfq_id}::${shipmentNumber}`;
    const containers = normalizeContainerRows(containerMap.get(containerKey) || []);

    const shipment: RFQShipment = {
      shipment_number: shipmentNumber,
      pol: row.pol || "TBD",
      pod: row.pod || "TBD",
      ready_date: normalizeDateLike(row.ready_date),
      delivery_deadline: normalizeDateLike(row.delivery_deadline),
      service_type: normalizeServiceType(row.service_type),
      pickup_address: toNonEmptyOrNull(row.pickup_address),
      delivery_address: toNonEmptyOrNull(row.delivery_address),
      containers:
        containers.length > 0
          ? containers
          : [{ line_number: 1, container_type: "40HQ", qty: 1 }],
      ...defaultFieldsForMode((row.freight_mode as FreightMode) || "ocean"),
    };

    const existing = byRfq.get(row.rfq_id) || [];
    existing.push(shipment);
    byRfq.set(row.rfq_id, existing);
  }

  return byRfq;
}

export function flattenShipmentsToLegacyFields(shipments: RFQShipment[]) {
  const polLines: string[] = [];
  const podLines: string[] = [];
  const containerTypeLines: string[] = [];
  const qtyLines: string[] = [];
  const readyDateLines: string[] = [];
  const deliveryDeadlineLines: string[] = [];
  const pickupAddressLines: string[] = [];
  const deliveryAddressLines: string[] = [];

  const sortedShipments = [...shipments].sort(
    (a, b) => toPositiveInt(a.shipment_number, 1) - toPositiveInt(b.shipment_number, 1)
  );

  for (const shipment of sortedShipments) {
    const containers =
      shipment.containers.length > 0
        ? shipment.containers
        : [{ line_number: 1, container_type: "40HQ", qty: 1 }];

    for (const container of containers) {
      polLines.push(shipment.pol || "TBD");
      podLines.push(shipment.pod || "TBD");
      containerTypeLines.push(normalizeContainerType(container.container_type));
      qtyLines.push(String(toPositiveInt(container.qty, 1)));
      readyDateLines.push(shipment.ready_date || "");
      deliveryDeadlineLines.push(shipment.delivery_deadline || "");
      pickupAddressLines.push(shipment.pickup_address || "");
      deliveryAddressLines.push(shipment.delivery_address || "");
    }
  }

  const firstShipment = sortedShipments[0];

  return {
    pol: polLines.join("\n"),
    pod: podLines.join("\n"),
    container_type: containerTypeLines.join("\n"),
    qty: qtyLines.join("\n"),
    ready_date: readyDateLines.filter(Boolean).join("\n") || null,
    delivery_deadline: deliveryDeadlineLines.filter(Boolean).join("\n") || null,
    pickup_address: pickupAddressLines.filter(Boolean).join("\n") || null,
    delivery_address: deliveryAddressLines.filter(Boolean).join("\n") || null,
    service_type: firstShipment?.service_type || "port-to-port",
  };
}

export function buildRFQWithShipments(
  rfq: MasterRFQ,
  normalizedShipments: RFQShipment[] | undefined
): MasterRFQ {
  const shipments =
    normalizedShipments && normalizedShipments.length > 0
      ? normalizedShipments
      : buildLegacyShipmentsFromRFQ(rfq);

  const firstShipment = shipments[0];
  const flattened = flattenShipmentsToLegacyFields(shipments);

  return {
    ...rfq,
    pol: firstShipment?.pol || rfq.pol || "TBD",
    pod: firstShipment?.pod || rfq.pod || "TBD",
    container_type: flattened.container_type || rfq.container_type || "40HQ",
    qty: flattened.qty || rfq.qty || "1",
    ready_date: firstShipment?.ready_date || rfq.ready_date || "",
    delivery_deadline: firstShipment?.delivery_deadline || rfq.delivery_deadline || null,
    service_type: (rfq.service_type || firstShipment?.service_type || "port-to-port") as ServiceType,
    pickup_address: firstShipment?.pickup_address || rfq.pickup_address || null,
    delivery_address: firstShipment?.delivery_address || rfq.delivery_address || null,
    shipments,
    shipment_count: shipments.length,
  };
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  const asString = String(value).trim();
  return asString.length > 0 ? asString : null;
}

export function mapMasterRFQRow(row: Record<string, unknown>): MasterRFQ {
  return {
    rfq_id: String(row.rfq_id || ""),
    thread_id: String(row.thread_id || ""),
    customer_email: String(row.customer_email || ""),
    status: String(row.status || "Processing") as MasterRFQ["status"],
    pol: String(row.pol || ""),
    pod: String(row.pod || ""),
    container_type: String(row.container_type || ""),
    qty: String(row.qty || ""),
    ready_date: String(row.ready_date || ""),
    delivery_deadline: toNullableString(row.delivery_deadline),
    service_type: normalizeServiceType(String(row.service_type || "port-to-port")),
    pickup_address: toNullableString(row.pickup_address),
    delivery_address: toNullableString(row.delivery_address),
    received_at: String(row.received_at || ""),
    selected_agent: toNullableString(row.selected_agent),
    final_price_usd: toNullableString(row.final_price_usd),
    final_price_aed: toNullableString(row.final_price_aed),
    quoted_at: toNullableString(row.quoted_at),
    deleted_at: toNullableString(row.deleted_at),
  };
}

function normalizeDateStringOrNA(value: unknown): string {
  const normalized = normalizeDateLike(typeof value === "string" ? value : null);
  return normalized || "N/A";
}

export function mapNormalizedQuoteToLegacy(row: Record<string, unknown>): AgentQuote {
  const priceValue = row.price;
  const price =
    typeof priceValue === "number"
      ? String(priceValue)
      : typeof priceValue === "string" && priceValue.trim().length > 0
        ? priceValue
        : "N/A";

  const transitTime =
    typeof row.transit_time === "number"
      ? String(row.transit_time)
      : typeof row.transit_time === "string" && row.transit_time.trim().length > 0
        ? row.transit_time
        : "N/A";

  const freeTime =
    typeof row.free_time === "number"
      ? String(row.free_time)
      : typeof row.free_time === "string" && row.free_time.trim().length > 0
        ? row.free_time
        : "N/A";

  return {
    rfq_id: String(row.rfq_id || ""),
    match: String(row.match || ""),
    agent_name: String(row.agent_name || ""),
    agent_email: String(row.agent_email || ""),
    shipment_number: String(row.shipment_number || "1"),
    carrier: String(row.carrier || "N/A"),
    price,
    currency: String(row.currency || "USD"),
    etd: normalizeDateStringOrNA(row.etd),
    transit_time: transitTime,
    free_time: freeTime,
    validity: normalizeDateStringOrNA(row.validity),
    status: String(row.status || "Invalid_Quote") as AgentQuote["status"],
    sent_at: String(row.sent_at || ""),
    received_at: String(row.received_at || ""),
    surcharges: (row.surcharges as QuoteSurcharges) ?? null,
    free_time_details: (row.free_time_details as FreeTimeDetails) ?? null,
    validity_date: typeof row.validity_date === "string" ? row.validity_date : null,
    conditions: typeof row.conditions === "string" ? row.conditions : null,
    freight_mode: (typeof row.freight_mode === "string" ? row.freight_mode : "ocean") as FreightMode,
  };
}
