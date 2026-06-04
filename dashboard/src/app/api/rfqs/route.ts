import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FreightMode, RFQShipment } from "@/types/rfq";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import type { ApiErrorPayload } from "@/lib/validation";
import { flattenShipmentsToLegacyFields } from "@/lib/rfq-normalization";
import { fetchWorkspaceRFQs } from "@/lib/rfqs-query";

export const dynamic = "force-dynamic";


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
    const rfqs = await fetchWorkspaceRFQs(supabase, workspaceId);
    return NextResponse.json(rfqs);
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
  "airport-to-airport",
  "door-to-airport",
  "airport-to-door",
  "terminal-to-terminal",
  "door-to-terminal",
  "terminal-to-door",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const VALID_FREIGHT_MODES = new Set<FreightMode>(["ocean", "air", "land"]);

interface ManualRFQPiece {
  count: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  packaging_type: string | null;
}

interface ManualRFQTruckDetail {
  equipment_type: string | null;
  load_type: string | null;
  weight_lbs: number | null;
  nmfc_class: string | null;
  origin_zip: string | null;
  destination_zip: string | null;
  accessorials: string[] | null;
}

interface ManualRFQShipment {
  freight_mode: FreightMode;
  pol: string;
  pod: string;
  service_type: string;
  ready_date: string | null;
  delivery_deadline: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  containers: Array<{ container_type: string; qty: number }>;
  pieces: ManualRFQPiece[];
  truck_detail: ManualRFQTruckDetail | null;
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

    const freightMode = (typeof shipment.freight_mode === "string" ? shipment.freight_mode.trim() : "ocean") as FreightMode;
    if (!VALID_FREIGHT_MODES.has(freightMode)) {
      details.push(`shipments[${i}].freight_mode must be one of: ocean, air, land.`);
    }

    const pol = typeof shipment.pol === "string" ? shipment.pol.trim() : "";
    if (!pol) details.push(`shipments[${i}].pol is required.`);

    const pod = typeof shipment.pod === "string" ? shipment.pod.trim() : "";
    if (!pod) details.push(`shipments[${i}].pod is required.`);

    const serviceType = typeof shipment.service_type === "string" ? shipment.service_type.trim() : "port-to-port";
    if (!VALID_SERVICE_TYPES.has(serviceType)) {
      details.push(`shipments[${i}].service_type is invalid.`);
    }

    // Containers (required for ocean, optional for air/land)
    const rawContainers = Array.isArray(shipment.containers) ? shipment.containers : [];
    if (freightMode === "ocean" && rawContainers.length === 0) {
      details.push(`shipments[${i}].containers must have at least one entry for ocean freight.`);
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

    // Pieces (for air freight)
    const rawPieces = Array.isArray(shipment.pieces) ? shipment.pieces : [];
    const pieces: ManualRFQPiece[] = [];
    for (const rp of rawPieces) {
      if (!rp || typeof rp !== "object") continue;
      const p = rp as Record<string, unknown>;
      pieces.push({
        count: typeof p.count === "number" && Number.isFinite(p.count) ? p.count : null,
        length_cm: typeof p.length_cm === "number" && Number.isFinite(p.length_cm) ? p.length_cm : null,
        width_cm: typeof p.width_cm === "number" && Number.isFinite(p.width_cm) ? p.width_cm : null,
        height_cm: typeof p.height_cm === "number" && Number.isFinite(p.height_cm) ? p.height_cm : null,
        weight_kg: typeof p.weight_kg === "number" && Number.isFinite(p.weight_kg) ? p.weight_kg : null,
        packaging_type: typeof p.packaging_type === "string" && p.packaging_type.trim() ? p.packaging_type.trim() : null,
      });
    }

    // Truck detail (for land freight)
    let truckDetail: ManualRFQTruckDetail | null = null;
    if (freightMode === "land") {
      const td = (shipment.truck_detail && typeof shipment.truck_detail === "object"
        ? shipment.truck_detail
        : shipment) as Record<string, unknown>;
      const loadTypeRaw = typeof td.load_type === "string" ? td.load_type.trim().toUpperCase() : "";
      const rawAccessorials = Array.isArray(td.accessorials) ? td.accessorials : [];
      const accessorials = rawAccessorials
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .map((a) => a.trim());
      truckDetail = {
        equipment_type: typeof td.equipment_type === "string" && td.equipment_type.trim() ? td.equipment_type.trim() : null,
        load_type: loadTypeRaw === "FTL" || loadTypeRaw === "LTL" || loadTypeRaw === "PTL" ? loadTypeRaw : null,
        weight_lbs: typeof td.weight_lbs === "number" && Number.isFinite(td.weight_lbs) ? td.weight_lbs : null,
        nmfc_class: typeof td.nmfc_class === "string" && td.nmfc_class.trim() ? td.nmfc_class.trim() : null,
        origin_zip: typeof td.origin_zip === "string" && td.origin_zip.trim() ? td.origin_zip.trim().toUpperCase() : null,
        destination_zip: typeof td.destination_zip === "string" && td.destination_zip.trim() ? td.destination_zip.trim().toUpperCase() : null,
        accessorials: accessorials.length > 0 ? accessorials : null,
      };
    }

    shipments.push({
      freight_mode: freightMode,
      pol,
      pod,
      service_type: serviceType,
      ready_date: typeof shipment.ready_date === "string" && shipment.ready_date.trim() ? shipment.ready_date.trim() : null,
      delivery_deadline: typeof shipment.delivery_deadline === "string" && shipment.delivery_deadline.trim() ? shipment.delivery_deadline.trim() : null,
      pickup_address: typeof shipment.pickup_address === "string" && shipment.pickup_address.trim() ? shipment.pickup_address.trim() : null,
      delivery_address: typeof shipment.delivery_address === "string" && shipment.delivery_address.trim() ? shipment.delivery_address.trim() : null,
      containers,
      pieces,
      truck_detail: truckDetail,
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

    // Insert normalized shipments + containers (with cleanup on partial failure)
    try {
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
          freight_mode: s.freight_mode || "ocean",
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

        // Insert pieces for air freight
        if (s.freight_mode === "air" && s.pieces.length > 0) {
          for (let k = 0; k < s.pieces.length; k++) {
            const p = s.pieces[k];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: pieceError } = await (supabase.from as any)("rfq_shipment_pieces").insert({
              workspace_id: workspaceId,
              rfq_id: rfqId,
              shipment_number: shipmentNumber,
              piece_number: k + 1,
              count: p.count,
              length_cm: p.length_cm,
              width_cm: p.width_cm,
              height_cm: p.height_cm,
              weight_kg: p.weight_kg,
              packaging_type: p.packaging_type,
            });
            if (pieceError) throw pieceError;
          }
        }

        // Insert truck details for land freight
        if (s.freight_mode === "land" && s.truck_detail) {
          const td = s.truck_detail;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: truckError } = await (supabase.from as any)("rfq_shipment_truck_details").insert({
            workspace_id: workspaceId,
            rfq_id: rfqId,
            shipment_number: shipmentNumber,
            equipment_type: td.equipment_type,
            load_type: td.load_type,
            weight_lbs: td.weight_lbs,
            nmfc_class: td.nmfc_class,
            commodity_description: s.commodity_description,
            hazmat: s.is_dangerous_goods,
            accessorials: td.accessorials,
            origin_zip: td.origin_zip,
            destination_zip: td.destination_zip,
          });
          if (truckError) throw truckError;
        }
      }
    } catch (insertError) {
      // Clean up orphaned rows on partial failure
      console.error("Shipment/container/pieces insert failed, cleaning up:", insertError);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from as any)("rfq_shipment_truck_details").delete().eq("rfq_id", rfqId).eq("workspace_id", workspaceId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from as any)("rfq_shipment_pieces").delete().eq("rfq_id", rfqId).eq("workspace_id", workspaceId);
      await supabase.from("rfq_shipment_containers").delete().eq("rfq_id", rfqId).eq("workspace_id", workspaceId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from as any)("rfq_shipments").delete().eq("rfq_id", rfqId).eq("workspace_id", workspaceId);
      await supabase.from("master_rfqs").delete().eq("rfq_id", rfqId).eq("workspace_id", workspaceId);
      throw insertError;
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
