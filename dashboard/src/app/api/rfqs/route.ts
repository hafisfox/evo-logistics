import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MasterRFQ, RFQShipment } from "@/types/rfq";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import type { ApiErrorPayload } from "@/lib/validation";
import {
  buildRFQWithShipments,
  buildShipmentsByRfq,
  flattenShipmentsToLegacyFields,
  mapMasterRFQRow,
  type RFQShipmentContainerRow,
  type RFQShipmentRow,
} from "@/lib/rfq-normalization";

export const dynamic = "force-dynamic";

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code || "") : "";
  const message =
    "message" in error ? String((error as { message?: string }).message || "") : "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("Could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export async function GET() {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }
  const workspaceId = scope.context.workspaceId;

  try {
    const supabase = await createClient();
    const { data: rfqRows, error: rfqError } = await supabase
      .from("master_rfqs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("received_at", { ascending: false });

    if (rfqError) throw rfqError;

    const baseRfqs = ((rfqRows || []) as Record<string, unknown>[]).map(mapMasterRFQRow);
    const rfqIds = baseRfqs.map((rfq) => rfq.rfq_id).filter(Boolean);
    if (rfqIds.length === 0) {
      return NextResponse.json([] as MasterRFQ[]);
    }

    let shipmentMap = new Map<string, RFQShipment[]>();
    try {
      const [shipmentsRes, containersRes] = await Promise.all([
        supabase
          .from("rfq_shipments")
          .select(
            "workspace_id, rfq_id, shipment_number, pol, pod, ready_date, delivery_deadline, service_type, pickup_address, delivery_address"
          )
          .eq("workspace_id", workspaceId)
          .in("rfq_id", rfqIds),
        supabase
          .from("rfq_shipment_containers")
          .select("workspace_id, rfq_id, shipment_number, line_number, container_type, qty")
          .eq("workspace_id", workspaceId)
          .in("rfq_id", rfqIds),
      ]);

      if (shipmentsRes.error) throw shipmentsRes.error;
      if (containersRes.error) throw containersRes.error;

      shipmentMap = buildShipmentsByRfq(
        (shipmentsRes.data || []) as RFQShipmentRow[],
        (containersRes.data || []) as RFQShipmentContainerRow[]
      );
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }

    const rfqs = baseRfqs.map((rfq) => buildRFQWithShipments(rfq, shipmentMap.get(rfq.rfq_id)));
    return NextResponse.json(rfqs as MasterRFQ[]);
  } catch (error) {
    console.error("Failed to fetch RFQs:", error);
    return NextResponse.json(
      { error: "Failed to fetch RFQs" },
      { status: 500 }
    );
  }
}

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

const VALID_SERVICE_TYPES = new Set([
  "port-to-port",
  "door-to-port",
  "port-to-door",
  "door-to-door",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

interface ManualRFQShipment {
  pol: string;
  pod: string;
  service_type: string;
  ready_date: string | null;
  delivery_deadline: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  containers: Array<{ container_type: string; qty: number }>;
  commodity_description: string | null;
  hs_code: string | null;
  incoterms: string | null;
  is_dangerous_goods: boolean;
  is_reefer: boolean;
  special_requirements: string | null;
  cargo_weight_kg: number | null;
  cargo_volume_cbm: number | null;
}

export async function POST(request: Request) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);
  const workspaceId = scope.context.workspaceId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid payload", details: ["Body must be valid JSON."] }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError({ error: "Invalid payload", details: ["Body must be a JSON object."] }, 400);
  }

  const record = body as Record<string, unknown>;
  const details: string[] = [];

  const customerEmail = typeof record.customer_email === "string" ? record.customer_email.trim().toLowerCase() : "";
  if (!customerEmail || !EMAIL_REGEX.test(customerEmail)) {
    details.push("customer_email must be a valid email address.");
  }

  const rawShipments = Array.isArray(record.shipments) ? record.shipments : [];
  if (rawShipments.length === 0) {
    details.push("At least one shipment is required.");
  }

  const shipments: ManualRFQShipment[] = [];
  for (let i = 0; i < rawShipments.length; i++) {
    const s = rawShipments[i];
    if (!s || typeof s !== "object") {
      details.push(`shipments[${i}] must be an object.`);
      continue;
    }
    const shipment = s as Record<string, unknown>;

    const pol = typeof shipment.pol === "string" ? shipment.pol.trim() : "";
    if (!pol) details.push(`shipments[${i}].pol is required.`);

    const pod = typeof shipment.pod === "string" ? shipment.pod.trim() : "";
    if (!pod) details.push(`shipments[${i}].pod is required.`);

    const serviceType = typeof shipment.service_type === "string" ? shipment.service_type.trim() : "port-to-port";
    if (!VALID_SERVICE_TYPES.has(serviceType)) {
      details.push(`shipments[${i}].service_type must be one of: port-to-port, door-to-port, port-to-door, door-to-door.`);
    }

    const rawContainers = Array.isArray(shipment.containers) ? shipment.containers : [];
    if (rawContainers.length === 0) {
      details.push(`shipments[${i}].containers must have at least one entry.`);
    }

    const containers: Array<{ container_type: string; qty: number }> = [];
    for (let j = 0; j < rawContainers.length; j++) {
      const c = rawContainers[j];
      if (!c || typeof c !== "object") continue;
      const ct = c as Record<string, unknown>;
      const containerType = typeof ct.container_type === "string" ? ct.container_type.trim() : "";
      const qty = typeof ct.qty === "number" ? ct.qty : parseInt(String(ct.qty || "1"), 10);
      if (containerType && Number.isFinite(qty) && qty > 0) {
        containers.push({ container_type: containerType, qty });
      }
    }

    shipments.push({
      pol,
      pod,
      service_type: serviceType,
      ready_date: typeof shipment.ready_date === "string" && shipment.ready_date.trim() ? shipment.ready_date.trim() : null,
      delivery_deadline: typeof shipment.delivery_deadline === "string" && shipment.delivery_deadline.trim() ? shipment.delivery_deadline.trim() : null,
      pickup_address: typeof shipment.pickup_address === "string" && shipment.pickup_address.trim() ? shipment.pickup_address.trim() : null,
      delivery_address: typeof shipment.delivery_address === "string" && shipment.delivery_address.trim() ? shipment.delivery_address.trim() : null,
      containers,
      commodity_description: typeof shipment.commodity_description === "string" && shipment.commodity_description.trim() ? shipment.commodity_description.trim() : null,
      hs_code: typeof shipment.hs_code === "string" && shipment.hs_code.trim() ? shipment.hs_code.trim() : null,
      incoterms: typeof shipment.incoterms === "string" && shipment.incoterms.trim() ? shipment.incoterms.trim() : null,
      is_dangerous_goods: shipment.is_dangerous_goods === true,
      is_reefer: shipment.is_reefer === true,
      special_requirements: typeof shipment.special_requirements === "string" && shipment.special_requirements.trim() ? shipment.special_requirements.trim() : null,
      cargo_weight_kg: typeof shipment.cargo_weight_kg === "number" && Number.isFinite(shipment.cargo_weight_kg) ? shipment.cargo_weight_kg : null,
      cargo_volume_cbm: typeof shipment.cargo_volume_cbm === "number" && Number.isFinite(shipment.cargo_volume_cbm) ? shipment.cargo_volume_cbm : null,
    });
  }

  if (details.length > 0) {
    return jsonError({ error: "Invalid RFQ payload", details }, 400);
  }

  try {
    const supabase = await createClient();
    const rfqId = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const threadId = `manual-${rfqId}`;

    // Build legacy flat fields from shipments for backward compatibility
    const legacyShipments = shipments.map((s, idx) => ({
      shipment_number: idx + 1,
      pol: s.pol,
      pod: s.pod,
      service_type: s.service_type as "port-to-port" | "door-to-port" | "port-to-door" | "door-to-door",
      ready_date: s.ready_date,
      delivery_deadline: s.delivery_deadline,
      pickup_address: s.pickup_address,
      delivery_address: s.delivery_address,
      containers: s.containers.map((c, ci) => ({
        line_number: ci + 1,
        container_type: c.container_type,
        qty: c.qty,
      })),
    }));

    const flattened = flattenShipmentsToLegacyFields(legacyShipments as RFQShipment[]);

    // Insert master_rfqs row
    const { error: rfqError } = await supabase.from("master_rfqs").insert({
      workspace_id: workspaceId,
      rfq_id: rfqId,
      thread_id: threadId,
      customer_email: customerEmail,
      status: "Processing",
      pol: flattened.pol,
      pod: flattened.pod,
      container_type: flattened.container_type,
      qty: flattened.qty,
      ready_date: flattened.ready_date,
      delivery_deadline: flattened.delivery_deadline,
      service_type: flattened.service_type as "port-to-port" | "door-to-port" | "port-to-door" | "door-to-door",
      pickup_address: flattened.pickup_address,
      delivery_address: flattened.delivery_address,
      received_at: new Date().toISOString(),
    });

    if (rfqError) throw rfqError;

    // Insert normalized shipments + containers
    for (let i = 0; i < shipments.length; i++) {
      const s = shipments[i];
      const shipmentNumber = i + 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new columns not yet in generated types
      const { error: shipmentError } = await (supabase.from as any)("rfq_shipments").insert({
        workspace_id: workspaceId,
        rfq_id: rfqId,
        shipment_number: shipmentNumber,
        pol: s.pol,
        pod: s.pod,
        ready_date: s.ready_date,
        delivery_deadline: s.delivery_deadline,
        service_type: s.service_type,
        pickup_address: s.pickup_address,
        delivery_address: s.delivery_address,
        commodity_description: s.commodity_description,
        hs_code: s.hs_code,
        incoterms: s.incoterms,
        is_dangerous_goods: s.is_dangerous_goods,
        is_reefer: s.is_reefer,
        special_requirements: s.special_requirements,
        cargo_weight_kg: s.cargo_weight_kg,
        cargo_volume_cbm: s.cargo_volume_cbm,
        freight_mode: "ocean",
      });

      if (shipmentError) throw shipmentError;

      for (let j = 0; j < s.containers.length; j++) {
        const c = s.containers[j];
        const { error: containerError } = await supabase.from("rfq_shipment_containers").insert({
          workspace_id: workspaceId,
          rfq_id: rfqId,
          shipment_number: shipmentNumber,
          line_number: j + 1,
          container_type: c.container_type,
          qty: c.qty,
        });
        if (containerError) throw containerError;
      }
    }

    // Log activity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
    await (supabase.from as any)("activity_logs").insert({
      workspace_id: workspaceId,
      entity_type: "rfq",
      entity_id: rfqId,
      action: "created",
      actor_id: scope.context.userId,
      metadata: { source: "manual", shipment_count: shipments.length },
    });

    return NextResponse.json({ rfq_id: rfqId }, { status: 201 });
  } catch (error) {
    console.error("Failed to create manual RFQ:", error);
    return jsonError({ error: "Failed to create RFQ" }, 500);
  }
}
