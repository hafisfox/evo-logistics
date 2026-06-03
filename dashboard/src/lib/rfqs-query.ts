import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import type { MasterRFQ, RFQShipment } from "@/types/rfq";
import {
  buildRFQWithShipments,
  buildShipmentsByRfq,
  mapMasterRFQRow,
  type RFQShipmentContainerRow,
  type RFQShipmentRow,
} from "@/lib/rfq-normalization";
import { isMissingRelationError } from "@/lib/supabase-errors";

/**
 * Loads all non-deleted RFQs for a workspace with their normalized shipments
 * and containers. Shared by the `/api/rfqs` route handler and the server-side
 * prefetch on the RFQ pipeline page so both stay in lockstep.
 */
export async function fetchWorkspaceRFQs(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<MasterRFQ[]> {
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
    return [];
  }

  let shipmentMap = new Map<string, RFQShipment[]>();
  try {
    const [shipmentsRes, containersRes] = await Promise.all([
      supabase
        .from("rfq_shipments")
        .select(
          "workspace_id, rfq_id, shipment_number, pol, pod, ready_date, delivery_deadline, service_type, pickup_address, delivery_address, freight_mode"
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
      (shipmentsRes.data || []) as unknown as RFQShipmentRow[],
      (containersRes.data || []) as RFQShipmentContainerRow[]
    );
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error;
    }
  }

  return baseRfqs.map((rfq) => buildRFQWithShipments(rfq, shipmentMap.get(rfq.rfq_id)));
}
