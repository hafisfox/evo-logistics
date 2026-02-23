import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { MasterRFQ, RFQShipment } from "@/types/rfq";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  buildRFQWithShipments,
  buildShipmentsByRfq,
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
