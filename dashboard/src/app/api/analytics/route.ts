import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DashboardKPIs, PipelineCount, ActivityItem } from "@/types/analytics";
import type { FreightMode } from "@/types/rfq";
import type { AgentQuote, RFQShipment } from "@/types/rfq";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  buildRFQWithShipments,
  buildShipmentsByRfq,
  mapMasterRFQRow,
  mapNormalizedQuoteToLegacy,
  type RFQShipmentContainerRow,
  type RFQShipmentRow,
} from "@/lib/rfq-normalization";
import { isMissingRelationError } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";


function buildRouteSummary(rfq: {
  pol: string;
  pod: string;
  shipment_count?: number;
  shipments?: Array<{ pol: string; pod: string }>;
}) {
  const firstShipment = rfq.shipments?.[0];
  const pol = firstShipment?.pol || rfq.pol || "TBD";
  const pod = firstShipment?.pod || rfq.pod || "TBD";
  const shipmentCount = rfq.shipment_count || rfq.shipments?.length || 1;
  const extra = Math.max(shipmentCount - 1, 0);
  if (extra <= 0) return `${pol} → ${pod}`;
  return `${pol} → ${pod} (+${extra} shipments)`;
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

    const [rfqsRes, shipmentsRes, containersRes, normalizedQuotesRes, legacyQuotesRes] = await Promise.all([
      supabase
        .from("master_rfqs")
        .select(
          "rfq_id, thread_id, customer_email, status, pol, pod, container_type, qty, ready_date, delivery_deadline, service_type, pickup_address, delivery_address, received_at, selected_agent, final_price_usd, final_price_aed, quoted_at, deleted_at"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("rfq_shipments")
        .select(
          "workspace_id, rfq_id, shipment_number, pol, pod, ready_date, delivery_deadline, service_type, pickup_address, delivery_address"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("rfq_shipment_containers")
        .select("workspace_id, rfq_id, shipment_number, line_number, container_type, qty")
        .eq("workspace_id", workspaceId),
      supabase
        .from("agent_quotes")
        .select(
          "rfq_id, match, status, agent_name, agent_email, shipment_number, carrier, price, currency, etd, transit_time, free_time, validity, sent_at, received_at"
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("agent_outbound_log")
        .select(
          "rfq_id, match, status, agent_name, agent_email, shipment_number, carrier, price, currency, etd, transit_time, free_time, validity, sent_at, received_at"
        )
        .eq("workspace_id", workspaceId),
    ]);

    if (rfqsRes.error) throw rfqsRes.error;
    if (legacyQuotesRes.error) throw legacyQuotesRes.error;

    const baseRfqs = ((rfqsRes.data || []) as Record<string, unknown>[])
      .map(mapMasterRFQRow)
      .filter((rfq) => !rfq.deleted_at);

    let shipmentMap = new Map<string, RFQShipment[]>();
    if (!shipmentsRes.error && !containersRes.error) {
      shipmentMap = buildShipmentsByRfq(
        (shipmentsRes.data || []) as RFQShipmentRow[],
        (containersRes.data || []) as RFQShipmentContainerRow[]
      );
    } else if (
      (shipmentsRes.error && !isMissingRelationError(shipmentsRes.error)) ||
      (containersRes.error && !isMissingRelationError(containersRes.error))
    ) {
      throw shipmentsRes.error || containersRes.error;
    }

    const rfqs = baseRfqs.map((rfq) => buildRFQWithShipments(rfq, shipmentMap.get(rfq.rfq_id)));

    let normalizedQuotes: AgentQuote[] = [];
    if (normalizedQuotesRes.error) {
      if (!isMissingRelationError(normalizedQuotesRes.error)) {
        throw normalizedQuotesRes.error;
      }
    } else {
      normalizedQuotes = ((normalizedQuotesRes.data || []) as Record<string, unknown>[]).map(
        mapNormalizedQuoteToLegacy
      );
    }

    const legacyQuotes = ((legacyQuotesRes.data || []) as Record<string, unknown>[]).map(
      mapNormalizedQuoteToLegacy
    );

    const quoteMap = new Map<string, AgentQuote>();
    for (const quote of legacyQuotes) {
      const key = quote.match || `${quote.rfq_id}-${quote.agent_email}-${quote.shipment_number}`;
      quoteMap.set(key, quote);
    }
    for (const quote of normalizedQuotes) {
      const key = quote.match || `${quote.rfq_id}-${quote.agent_email}-${quote.shipment_number}`;
      quoteMap.set(key, quote);
    }
    const quotes = Array.from(quoteMap.values());
    const receivedQuoteCountByRfq = new Map<string, number>();

    for (const quote of quotes) {
      if (quote.status !== "Received" || !quote.rfq_id) continue;
      const count = receivedQuoteCountByRfq.get(quote.rfq_id) || 0;
      receivedQuoteCountByRfq.set(quote.rfq_id, count + 1);
    }

    const today = new Date().toISOString().split("T")[0];

    // KPIs
    const activeRFQs = rfqs.filter((r) => r.status === "Processing").length;
    const awaitingQuotes = rfqs.filter((r) => {
      if (r.status !== "Processing" || !r.rfq_id) return false;
      const quoteCount = receivedQuoteCountByRfq.get(r.rfq_id) || 0;
      return quoteCount > 0 && quoteCount < 4;
    }).length;
    const pendingSelection = rfqs.filter((r) => {
      if (r.status !== "Processing" || !r.rfq_id) return false;
      const quoteCount = receivedQuoteCountByRfq.get(r.rfq_id) || 0;
      return quoteCount >= 2;
    }).length;
    const quotedToday = rfqs.filter(
      (r) => ["Quoted", "Followed_Up", "Customer_Replied"].includes(r.status as string) && r.quoted_at && r.quoted_at.startsWith(today)
    ).length;

    // Average response time
    const completedRFQs = rfqs.filter((r) => r.quoted_at && r.received_at);
    let avgResponseTimeHours: number | null = null;
    if (completedRFQs.length > 0) {
      const totalHours = completedRFQs.reduce((sum, r) => {
        const received = new Date(r.received_at as string).getTime();
        const quoted = new Date(r.quoted_at as string).getTime();
        return sum + (quoted - received) / (1000 * 60 * 60);
      }, 0);
      avgResponseTimeHours =
        Math.round((totalHours / completedRFQs.length) * 10) / 10;
    }

    const totalRFQs = rfqs.length;
    const selectedCount = rfqs.filter(
      (r) => r.status === "Selected" || (r.selected_agent && r.selected_agent.length > 0)
    ).length;
    const quotedCount = rfqs.filter(
      (r) => ["Quoted", "Followed_Up", "Customer_Replied", "Selected"].includes(r.status as string)
    ).length;
    const conversionRate = totalRFQs > 0 ? Math.round((selectedCount / totalRFQs) * 100) : 0;
    const totalRevenueAED = rfqs.reduce(
      (sum, r) => sum + (typeof r.final_price_aed === "number" ? r.final_price_aed : 0),
      0
    );
    const totalRevenueUSD = rfqs.reduce(
      (sum, r) => sum + (typeof r.final_price_usd === "number" ? r.final_price_usd : 0),
      0
    );

    const modeBreakdown: Record<FreightMode, { total: number; quoted: number; selected: number }> = {
      ocean: { total: 0, quoted: 0, selected: 0 },
      air: { total: 0, quoted: 0, selected: 0 },
      land: { total: 0, quoted: 0, selected: 0 },
    };
    for (const r of rfqs) {
      const mode = (r.freight_mode ?? "ocean") as FreightMode;
      const bucket = modeBreakdown[mode] ?? modeBreakdown.ocean;
      bucket.total += 1;
      if (["Quoted", "Followed_Up", "Customer_Replied", "Selected"].includes(r.status as string)) {
        bucket.quoted += 1;
      }
      if (r.status === "Selected" || (r.selected_agent && r.selected_agent.length > 0)) {
        bucket.selected += 1;
      }
    }

    const kpis: DashboardKPIs = {
      activeRFQs,
      awaitingQuotes,
      pendingSelection,
      quotedToday,
      avgResponseTimeHours,
      totalRFQs,
      selectedCount,
      quotedCount,
      conversionRate,
      totalRevenueAED,
      totalRevenueUSD,
      modeBreakdown,
    };

    // Pipeline counts
    const statusCounts: Record<string, number> = {};
    for (const r of rfqs) {
      if (!r.status) continue;
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }
    const pipeline: PipelineCount[] = Object.entries(statusCounts).map(
      ([status, count]) => ({ status, count })
    );

    // Recent activity (last 10)
    const activity: ActivityItem[] = rfqs
      .filter((r) => r.received_at)
      .sort((a, b) => {
        const da = new Date(a.received_at as string).getTime();
        const db = new Date(b.received_at as string).getTime();
        return db - da;
      })
      .slice(0, 10)
      .map((r) => ({
        rfq_id: r.rfq_id as string,
        customer_email: r.customer_email || "Unknown",
        status: r.status as string,
        timestamp: r.quoted_at || r.received_at as string,
        route: buildRouteSummary(r),
      }));

    return NextResponse.json({ kpis, pipeline, activity });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
