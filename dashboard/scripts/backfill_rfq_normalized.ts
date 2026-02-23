import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

interface MasterRFQRow {
  workspace_id: string;
  rfq_id: string;
  service_type: string;
  pol: string | null;
  pod: string | null;
  container_type: string | null;
  qty: string | null;
  ready_date: string | null;
  delivery_deadline: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
}

interface AgentOutboundRow {
  workspace_id: string;
  rfq_id: string;
  match: string;
  shipment_number: string | null;
  agent_name: string;
  agent_email: string;
  carrier: string;
  price: string | number | null;
  currency: string | null;
  etd: string | null;
  transit_time: string | null;
  free_time: string | null;
  validity: string | null;
  status: string;
  sent_at: string | null;
  received_at: string | null;
}

interface DOChargeRow {
  id: number;
  workspace_id: string;
  carrier: string;
  document: number | string;
  "20FT": number | string;
  "40FT": number | string;
  "40HQ": number | string;
}

interface DestinationChargeRow {
  id: number;
  workspace_id: string;
  charge_type: string;
  basis: string;
  "20FT": number | string;
  "40FT": number | string;
}

interface DerivedContainer {
  line_number: number;
  container_type: string;
  qty: number;
}

interface DerivedShipment {
  shipment_number: number;
  pol: string;
  pod: string;
  service_type: string;
  ready_date: string | null;
  delivery_deadline: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  containers: DerivedContainer[];
}

interface BackfillStats {
  rfqsRead: number;
  shipmentsUpserted: number;
  containersUpserted: number;
  quotesRead: number;
  quotesUpserted: number;
  doProfilesUpserted: number;
  doRatesUpserted: number;
  destinationItemsUpserted: number;
  destinationRatesUpserted: number;
}

function loadDotEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    const rawValue = line.slice(eq + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
    process.env[key] = value;
  }
}

function parseMultiValue(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function pickWithFallback(values: string[], index: number, fallback: string): string {
  if (index < values.length && values[index]) return values[index];
  if (values.length > 0 && values[values.length - 1]) return values[values.length - 1];
  return fallback;
}

function parsePositiveInt(value: string | null | undefined, fallback = 1): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeContainerType(value: string): string {
  const normalized = value.toUpperCase().replace(/\s+/g, "").replace(/['"]/g, "");
  if (normalized === "20GP") return "20FT";
  if (normalized === "40GP") return "40FT";
  if (normalized === "40HC") return "40HQ";
  if (normalized === "") return "40HQ";
  return normalized;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function normalizeQuoteStatus(status: string):
  | "Requested"
  | "Reminded"
  | "Received"
  | "Invalid_Quote" {
  if (status === "Requested" || status === "Reminded" || status === "Received" || status === "Invalid_Quote") {
    return status;
  }
  return "Invalid_Quote";
}

function toNumericOrNull(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || cleaned.toUpperCase() === "N/A" || cleaned.toUpperCase() === "NO_QUOTE") return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveShipments(rfq: MasterRFQRow): DerivedShipment[] {
  const pols = parseMultiValue(rfq.pol);
  const pods = parseMultiValue(rfq.pod);
  const containerTypes = parseMultiValue(rfq.container_type);
  const qtys = parseMultiValue(rfq.qty);
  const serviceTypes = parseMultiValue(rfq.service_type);
  const pickupAddresses = parseMultiValue(rfq.pickup_address);
  const deliveryAddresses = parseMultiValue(rfq.delivery_address);

  const lines = Math.max(pols.length, pods.length, containerTypes.length, qtys.length, 1);

  const expanded = Array.from({ length: lines }, (_, index) => ({
    pol: pickWithFallback(pols, index, "TBD"),
    pod: pickWithFallback(pods, index, "TBD"),
    service_type: pickWithFallback(serviceTypes, index, rfq.service_type || "port-to-port"),
    pickup_address: pickWithFallback(pickupAddresses, index, "") || null,
    delivery_address: pickWithFallback(deliveryAddresses, index, "") || null,
    container_type: normalizeContainerType(pickWithFallback(containerTypes, index, "40HQ")),
    qty: parsePositiveInt(pickWithFallback(qtys, index, "1"), 1),
  }));

  const shipments: DerivedShipment[] = [];
  let current: DerivedShipment | null = null;
  let previousGroupKey: string | null = null;

  for (const item of expanded) {
    const groupKey = `${item.pol}|${item.pod}|${item.service_type}|${item.pickup_address ?? ""}|${item.delivery_address ?? ""}`;
    if (!current || groupKey !== previousGroupKey) {
      current = {
        shipment_number: shipments.length + 1,
        pol: item.pol,
        pod: item.pod,
        service_type: item.service_type,
        ready_date: normalizeDate(rfq.ready_date),
        delivery_deadline: normalizeDate(rfq.delivery_deadline),
        pickup_address: item.pickup_address,
        delivery_address: item.delivery_address,
        containers: [],
      };
      shipments.push(current);
      previousGroupKey = groupKey;
    }

    current.containers.push({
      line_number: current.containers.length + 1,
      container_type: item.container_type,
      qty: item.qty,
    });
  }

  if (shipments.length === 0) {
    shipments.push({
      shipment_number: 1,
      pol: "TBD",
      pod: "TBD",
      service_type: rfq.service_type || "port-to-port",
      ready_date: normalizeDate(rfq.ready_date),
      delivery_deadline: normalizeDate(rfq.delivery_deadline),
      pickup_address: rfq.pickup_address,
      delivery_address: rfq.delivery_address,
      containers: [{ line_number: 1, container_type: "40HQ", qty: 1 }],
    });
  }

  return shipments;
}

async function main() {
  loadDotEnvIfPresent();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for backfill script.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stats: BackfillStats = {
    rfqsRead: 0,
    shipmentsUpserted: 0,
    containersUpserted: 0,
    quotesRead: 0,
    quotesUpserted: 0,
    doProfilesUpserted: 0,
    doRatesUpserted: 0,
    destinationItemsUpserted: 0,
    destinationRatesUpserted: 0,
  };

  const { data: rfqsData, error: rfqsError } = await supabase
    .from("master_rfqs")
    .select(
      "workspace_id, rfq_id, service_type, pol, pod, container_type, qty, ready_date, delivery_deadline, pickup_address, delivery_address"
    );

  if (rfqsError) throw rfqsError;

  const rfqs = (rfqsData ?? []) as MasterRFQRow[];
  stats.rfqsRead = rfqs.length;
  const shipmentCountByRfq = new Map<string, number>();
  const rfqByKey = new Map<string, MasterRFQRow>();

  for (const rfq of rfqs) {
    const key = `${rfq.workspace_id}|${rfq.rfq_id}`;
    rfqByKey.set(key, rfq);

    const shipments = deriveShipments(rfq);
    shipmentCountByRfq.set(key, shipments.length);

    for (const shipment of shipments) {
      const { error: shipmentError } = await supabase.from("rfq_shipments").upsert(
        {
          workspace_id: rfq.workspace_id,
          rfq_id: rfq.rfq_id,
          shipment_number: shipment.shipment_number,
          pol: shipment.pol,
          pod: shipment.pod,
          ready_date: shipment.ready_date,
          delivery_deadline: shipment.delivery_deadline,
          service_type: shipment.service_type,
          pickup_address: shipment.pickup_address,
          delivery_address: shipment.delivery_address,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,rfq_id,shipment_number" }
      );

      if (shipmentError) throw shipmentError;
      stats.shipmentsUpserted += 1;

      for (const container of shipment.containers) {
        const { error: containerError } = await supabase
          .from("rfq_shipment_containers")
          .upsert(
            {
              workspace_id: rfq.workspace_id,
              rfq_id: rfq.rfq_id,
              shipment_number: shipment.shipment_number,
              line_number: container.line_number,
              container_type: container.container_type,
              qty: container.qty,
            },
            { onConflict: "workspace_id,rfq_id,shipment_number,line_number" }
          );

        if (containerError) throw containerError;
        stats.containersUpserted += 1;
      }
    }
  }

  const { data: outboundData, error: outboundError } = await supabase
    .from("agent_outbound_log")
    .select(
      "workspace_id, rfq_id, match, shipment_number, agent_name, agent_email, carrier, price, currency, etd, transit_time, free_time, validity, status, sent_at, received_at"
    );

  if (outboundError) throw outboundError;

  const outboundRows = (outboundData ?? []) as AgentOutboundRow[];
  stats.quotesRead = outboundRows.length;

  for (const row of outboundRows) {
    const key = `${row.workspace_id}|${row.rfq_id}`;
    const shipmentNumber = parsePositiveInt(row.shipment_number, 1);
    const knownShipmentCount = shipmentCountByRfq.get(key) ?? 0;

    if (shipmentNumber > knownShipmentCount) {
      const rfq = rfqByKey.get(key);
      const { error: ensureShipmentError } = await supabase.from("rfq_shipments").upsert(
        {
          workspace_id: row.workspace_id,
          rfq_id: row.rfq_id,
          shipment_number: shipmentNumber,
          pol: rfq?.pol ?? "TBD",
          pod: rfq?.pod ?? "TBD",
          ready_date: normalizeDate(rfq?.ready_date),
          delivery_deadline: normalizeDate(rfq?.delivery_deadline),
          service_type: rfq?.service_type ?? "port-to-port",
          pickup_address: rfq?.pickup_address ?? null,
          delivery_address: rfq?.delivery_address ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,rfq_id,shipment_number" }
      );
      if (ensureShipmentError) throw ensureShipmentError;
      shipmentCountByRfq.set(key, shipmentNumber);
    }

    const { error: quoteError } = await supabase.from("agent_quotes").upsert(
      {
        workspace_id: row.workspace_id,
        rfq_id: row.rfq_id,
        shipment_number: shipmentNumber,
        match: row.match,
        agent_name: row.agent_name,
        agent_email: row.agent_email,
        carrier: row.carrier,
        price: toNumericOrNull(row.price),
        currency: row.currency || "USD",
        etd: normalizeDate(row.etd),
        transit_time: row.transit_time ? parsePositiveInt(row.transit_time, 0) : null,
        free_time: row.free_time ? parsePositiveInt(row.free_time, 0) : null,
        validity: normalizeDate(row.validity),
        status: normalizeQuoteStatus(row.status),
        sent_at: row.sent_at,
        received_at: row.received_at,
        raw_meta: { source: "agent_outbound_log_backfill" },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,match" }
    );

    if (quoteError) throw quoteError;
    stats.quotesUpserted += 1;
  }

  const { data: doChargesData, error: doChargesError } = await supabase
    .from("do_charges")
    .select('id, workspace_id, carrier, document, "20FT", "40FT", "40HQ"');

  if (doChargesError) throw doChargesError;

  const doCharges = (doChargesData ?? []) as DOChargeRow[];

  for (const row of doCharges) {
    const { data: profile, error: profileError } = await supabase
      .from("do_charge_profiles")
      .upsert(
        {
          workspace_id: row.workspace_id,
          carrier: row.carrier,
          document: toNumericOrNull(row.document) ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,carrier" }
      )
      .select("id")
      .single();

    if (profileError) throw profileError;
    stats.doProfilesUpserted += 1;

    const profileId = (profile as { id: number }).id;

    const rateRows = [
      { container_type: "20FT", rate: toNumericOrNull(row["20FT"]) ?? 0 },
      { container_type: "40FT", rate: toNumericOrNull(row["40FT"]) ?? 0 },
      { container_type: "40HQ", rate: toNumericOrNull(row["40HQ"]) ?? 0 },
    ];

    for (const rate of rateRows) {
      const { error: rateError } = await supabase.from("do_charge_rates").upsert(
        {
          profile_id: profileId,
          container_type: rate.container_type,
          rate: rate.rate,
        },
        { onConflict: "profile_id,container_type" }
      );
      if (rateError) throw rateError;
      stats.doRatesUpserted += 1;
    }
  }

  const { data: destinationData, error: destinationError } = await supabase
    .from("destination_charges")
    .select('id, workspace_id, charge_type, basis, "20FT", "40FT"');

  if (destinationError) throw destinationError;

  const destinationRows = (destinationData ?? []) as DestinationChargeRow[];

  for (const row of destinationRows) {
    const { data: item, error: itemError } = await supabase
      .from("destination_charge_items")
      .upsert(
        {
          workspace_id: row.workspace_id,
          charge_type: row.charge_type,
          basis: row.basis,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,charge_type,basis" }
      )
      .select("id")
      .single();

    if (itemError) throw itemError;
    stats.destinationItemsUpserted += 1;

    const itemId = (item as { id: number }).id;

    const rateRows = [
      { container_type: "20FT", rate: toNumericOrNull(row["20FT"]) ?? 0 },
      { container_type: "40FT", rate: toNumericOrNull(row["40FT"]) ?? 0 },
    ];

    for (const rate of rateRows) {
      const { error: rateError } = await supabase.from("destination_charge_rates").upsert(
        {
          item_id: itemId,
          container_type: rate.container_type,
          rate: rate.rate,
        },
        { onConflict: "item_id,container_type" }
      );
      if (rateError) throw rateError;
      stats.destinationRatesUpserted += 1;
    }
  }

  console.log("RFQ normalization backfill complete:");
  console.table(stats);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
