import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AgentQuote, RFQShipment } from "@/types/rfq";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import type { ApiErrorPayload } from "@/lib/validation";
import {
  buildRFQWithShipments,
  buildShipmentsByRfq,
  mapMasterRFQRow,
  mapNormalizedQuoteToLegacy,
  type RFQShipmentContainerRow,
  type RFQShipmentRow,
  type RFQShipmentPieceRow,
  type RFQShipmentTruckDetailRow,
} from "@/lib/rfq-normalization";

// rfq_shipment_pieces and rfq_shipment_truck_details are newer than the generated
// Database types; cast the query builder to bypass typing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables not yet in generated types
type AnyTable = (name: string) => any;
import { isMissingRelationError } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }
  const workspaceId = scope.context.workspaceId;

  try {
    const { rfqId } = await params;
    const supabase = await createClient();

    const rfqRes = await supabase
      .from("master_rfqs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("rfq_id", rfqId)
      .is("deleted_at", null)
      .single();

    if (rfqRes.error && rfqRes.error.code !== "PGRST116") {
      throw rfqRes.error;
    }

    const rfqData = rfqRes.data as Record<string, unknown> | null;

    if (!rfqData) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    const baseRfq = mapMasterRFQRow(rfqData);
    let normalizedShipments: RFQShipment[] | undefined;

    try {
      const fromAny = supabase.from as unknown as AnyTable;
      const [shipmentsRes, containersRes, piecesRes, trucksRes] = await Promise.all([
        supabase
          .from("rfq_shipments")
          .select(
            "workspace_id, rfq_id, shipment_number, pol, pod, ready_date, delivery_deadline, service_type, pickup_address, delivery_address, freight_mode"
          )
          .eq("workspace_id", workspaceId)
          .eq("rfq_id", rfqId),
        supabase
          .from("rfq_shipment_containers")
          .select("workspace_id, rfq_id, shipment_number, line_number, container_type, qty")
          .eq("workspace_id", workspaceId)
          .eq("rfq_id", rfqId),
        fromAny("rfq_shipment_pieces")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("rfq_id", rfqId),
        fromAny("rfq_shipment_truck_details")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("rfq_id", rfqId),
      ]);

      if (shipmentsRes.error) throw shipmentsRes.error;
      if (containersRes.error) throw containersRes.error;
      // Pieces/truck tables degrade gracefully if their migration is not applied yet.
      const pieceRows =
        piecesRes.error || !piecesRes.data ? [] : (piecesRes.data as RFQShipmentPieceRow[]);
      const truckRows =
        trucksRes.error || !trucksRes.data ? [] : (trucksRes.data as RFQShipmentTruckDetailRow[]);

      const shipmentMap = buildShipmentsByRfq(
        (shipmentsRes.data || []) as unknown as RFQShipmentRow[],
        (containersRes.data || []) as RFQShipmentContainerRow[],
        pieceRows,
        truckRows
      );
      normalizedShipments = shipmentMap.get(rfqId);
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }

    const quotesFromNormalized = await supabase
      .from("agent_quotes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("rfq_id", rfqId);

    let quotesRows: Record<string, unknown>[] = [];

    if (!quotesFromNormalized.error && (quotesFromNormalized.data || []).length > 0) {
      quotesRows = (quotesFromNormalized.data || []) as Record<string, unknown>[];
    } else {
      if (quotesFromNormalized.error && !isMissingRelationError(quotesFromNormalized.error)) {
        throw quotesFromNormalized.error;
      }

      const quotesLegacyRes = await supabase
        .from("agent_outbound_log")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("rfq_id", rfqId);

      if (quotesLegacyRes.error) throw quotesLegacyRes.error;
      quotesRows = (quotesLegacyRes.data || []) as Record<string, unknown>[];
    }

    const quotes = quotesRows.map(mapNormalizedQuoteToLegacy);

    return NextResponse.json({
      rfq: buildRFQWithShipments(baseRfq, normalizedShipments),
      quotes: quotes as AgentQuote[],
    });
  } catch (error) {
    console.error("Failed to fetch RFQ detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch RFQ detail" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  try {
    const { rfqId } = await params;
    const deletedAt = new Date().toISOString();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("master_rfqs")
      .update({ deleted_at: deletedAt })
      .eq("workspace_id", scope.context.workspaceId)
      .eq("rfq_id", rfqId)
      .is("deleted_at", null)
      .select("rfq_id, deleted_at")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return jsonError({ error: "RFQ not found" }, 404);
      }
      throw error;
    }

    if (!data) {
      return jsonError({ error: "RFQ not found" }, 404);
    }

    return NextResponse.json({
      success: true,
      rfq_id: (data as { rfq_id: string }).rfq_id,
      deleted_at: (data as { deleted_at: string }).deleted_at,
    });
  } catch (error) {
    console.error("Failed to delete RFQ:", error);
    return jsonError({ error: "Failed to delete RFQ" }, 500);
  }
}
