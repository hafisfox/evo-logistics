import type { SupabaseClient } from "@supabase/supabase-js";

import type { DashboardSummary } from "@/types/dashboard-summary";
import type { Database } from "@/types/supabase";
import type { DashboardKPIs, PipelineCount, ActivityItem } from "@/types/analytics";
import type { MasterRFQ, RFQShipment } from "@/types/rfq";
import {
  buildRFQWithShipments,
  buildShipmentsByRfq,
  mapMasterRFQRow,
  type RFQShipmentContainerRow,
  type RFQShipmentRow,
} from "@/lib/rfq-normalization";
import { isMissingRelationError } from "@/lib/supabase-errors";

const DASHBOARD_RECENT_RFQ_LIMIT = 8;
const DASHBOARD_ACTIVITY_LIMIT = 10;
export const DASHBOARD_SUMMARY_CACHE_TTL_MS = 20_000;

const QUOTED_TODAY_STATUSES = new Set(["Quoted", "Followed_Up", "Customer_Replied"]);
const QUOTED_STATUSES = new Set(["Quoted", "Followed_Up", "Customer_Replied", "Selected"]);

type DashboardSupabaseClient = SupabaseClient<Database>;

type DashboardMetricRow = {
  rfq_id: string | null;
  status: string | null;
  quoted_at: string | null;
  received_at: string | null;
  selected_agent: string | null;
  final_price_usd: number | null;
  final_price_aed: number | null;
};

type DashboardRecentRFQRow = Record<string, unknown>;

type ReceivedQuoteRow = {
  rfq_id: string | null;
  match: string | null;
  agent_email: string | null;
  shipment_number: string | number | null;
};

interface BuildDashboardSummaryOptions {
  workspaceId: string;
  supabase: DashboardSupabaseClient;
  recentRfqLimit?: number;
  activityLimit?: number;
}

interface DashboardSummaryCacheEntry {
  expiresAt: number;
  summary: DashboardSummary;
}

const dashboardSummaryCache = new Map<string, DashboardSummaryCacheEntry>();


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

function normalizeReceivedQuoteRows(rows: ReceivedQuoteRow[]) {
  const unique = new Set<string>();
  const countByRfq = new Map<string, number>();

  for (const row of rows) {
    const rfqId = typeof row.rfq_id === "string" ? row.rfq_id : "";
    if (!rfqId) continue;

    const key =
      typeof row.match === "string" && row.match.length > 0
        ? `match:${row.match}`
        : `${rfqId}:${String(row.agent_email || "").toLowerCase()}:${String(row.shipment_number || "")}`;

    if (unique.has(key)) continue;
    unique.add(key);

    const currentCount = countByRfq.get(rfqId) ?? 0;
    countByRfq.set(rfqId, currentCount + 1);
  }

  return countByRfq;
}

function getTodayDatePrefix() {
  return new Date().toISOString().split("T")[0];
}

function toMasterRFQRows(rows: DashboardRecentRFQRow[]): MasterRFQ[] {
  return rows.map(mapMasterRFQRow);
}

export async function buildDashboardSummary({
  workspaceId,
  supabase,
  recentRfqLimit = DASHBOARD_RECENT_RFQ_LIMIT,
  activityLimit = DASHBOARD_ACTIVITY_LIMIT,
}: BuildDashboardSummaryOptions): Promise<DashboardSummary> {
  const effectiveRecentLimit = Math.max(recentRfqLimit, activityLimit);

  const [metricsRes, recentRfqsRes] = await Promise.all([
    supabase
      .from("master_rfqs")
      .select("rfq_id, status, quoted_at, received_at, selected_agent, final_price_usd, final_price_aed")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    supabase
      .from("master_rfqs")
      .select(
        "rfq_id, thread_id, customer_email, status, pol, pod, container_type, qty, ready_date, delivery_deadline, service_type, pickup_address, delivery_address, received_at, selected_agent, final_price_usd, final_price_aed, quoted_at, deleted_at"
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("received_at", { ascending: false })
      .limit(effectiveRecentLimit),
  ]);

  if (metricsRes.error) throw metricsRes.error;
  if (recentRfqsRes.error) throw recentRfqsRes.error;

  const metricRows = ((metricsRes.data || []) as DashboardMetricRow[]).filter(
    (row) => typeof row.rfq_id === "string" && row.rfq_id.length > 0
  );

  const processingRfqIds = metricRows
    .filter((row) => row.status === "Processing")
    .map((row) => row.rfq_id as string);

  let receivedQuoteCountByRfq = new Map<string, number>();
  if (processingRfqIds.length > 0) {
    const [normalizedQuotesRes, legacyQuotesRes] = await Promise.all([
      supabase
        .from("agent_quotes")
        .select("rfq_id, match, agent_email, shipment_number")
        .eq("workspace_id", workspaceId)
        .eq("status", "Received")
        .in("rfq_id", processingRfqIds),
      supabase
        .from("agent_outbound_log")
        .select("rfq_id, match, agent_email, shipment_number")
        .eq("workspace_id", workspaceId)
        .eq("status", "Received")
        .in("rfq_id", processingRfqIds),
    ]);

    if (normalizedQuotesRes.error) throw normalizedQuotesRes.error;
    if (legacyQuotesRes.error) throw legacyQuotesRes.error;

    const combinedRows = [
      ...((legacyQuotesRes.data || []) as ReceivedQuoteRow[]),
      ...((normalizedQuotesRes.data || []) as ReceivedQuoteRow[]),
    ];
    receivedQuoteCountByRfq = normalizeReceivedQuoteRows(combinedRows);
  }

  const statusCounts: Record<string, number> = {};
  for (const row of metricRows) {
    const status = row.status || "Unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  const pipeline: PipelineCount[] = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));

  const todayDatePrefix = getTodayDatePrefix();
  const activeRFQs = statusCounts.Processing || 0;
  const awaitingQuotes = processingRfqIds.filter((rfqId) => {
    const quoteCount = receivedQuoteCountByRfq.get(rfqId) || 0;
    return quoteCount > 0 && quoteCount < 4;
  }).length;
  const pendingSelection = processingRfqIds.filter((rfqId) => {
    const quoteCount = receivedQuoteCountByRfq.get(rfqId) || 0;
    return quoteCount >= 2;
  }).length;
  const quotedToday = metricRows.filter(
    (row) =>
      QUOTED_TODAY_STATUSES.has(String(row.status || "")) &&
      typeof row.quoted_at === "string" &&
      row.quoted_at.startsWith(todayDatePrefix)
  ).length;

  let avgResponseTimeHours: number | null = null;
  const completedRows = metricRows.filter(
    (row) => typeof row.quoted_at === "string" && typeof row.received_at === "string"
  );
  if (completedRows.length > 0) {
    const totalHours = completedRows.reduce((sum, row) => {
      const receivedAt = new Date(row.received_at as string).getTime();
      const quotedAt = new Date(row.quoted_at as string).getTime();
      if (!Number.isFinite(receivedAt) || !Number.isFinite(quotedAt)) return sum;
      return sum + (quotedAt - receivedAt) / (1000 * 60 * 60);
    }, 0);

    avgResponseTimeHours = Math.round((totalHours / completedRows.length) * 10) / 10;
  }

  const totalRFQs = metricRows.length;
  const selectedCount = metricRows.filter(
    (row) => row.status === "Selected" || (row.selected_agent && row.selected_agent.length > 0)
  ).length;
  const quotedCount = metricRows.filter(
    (row) => QUOTED_STATUSES.has(String(row.status || ""))
  ).length;
  const conversionRate = totalRFQs > 0 ? Math.round((selectedCount / totalRFQs) * 100) : 0;
  const totalRevenueAED = metricRows.reduce(
    (sum, row) => sum + (typeof row.final_price_aed === "number" ? row.final_price_aed : 0),
    0
  );
  const totalRevenueUSD = metricRows.reduce(
    (sum, row) => sum + (typeof row.final_price_usd === "number" ? row.final_price_usd : 0),
    0
  );

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
  };

  const baseRecentRfqs = toMasterRFQRows((recentRfqsRes.data || []) as DashboardRecentRFQRow[]);
  const recentRfqIds = baseRecentRfqs.map((rfq) => rfq.rfq_id).filter(Boolean);

  let shipmentMap = new Map<string, RFQShipment[]>();
  if (recentRfqIds.length > 0) {
    const [shipmentsRes, containersRes] = await Promise.all([
      supabase
        .from("rfq_shipments")
        .select(
          "workspace_id, rfq_id, shipment_number, pol, pod, ready_date, delivery_deadline, service_type, pickup_address, delivery_address"
        )
        .eq("workspace_id", workspaceId)
        .in("rfq_id", recentRfqIds),
      supabase
        .from("rfq_shipment_containers")
        .select("workspace_id, rfq_id, shipment_number, line_number, container_type, qty")
        .eq("workspace_id", workspaceId)
        .in("rfq_id", recentRfqIds),
    ]);

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
  }

  const recentRfqs = baseRecentRfqs
    .map((rfq) => buildRFQWithShipments(rfq, shipmentMap.get(rfq.rfq_id)))
    .slice(0, recentRfqLimit);

  const activity: ActivityItem[] = baseRecentRfqs
    .map((rfq) => buildRFQWithShipments(rfq, shipmentMap.get(rfq.rfq_id)))
    .slice(0, activityLimit)
    .map((rfq) => ({
      rfq_id: rfq.rfq_id,
      customer_email: rfq.customer_email || "Unknown",
      status: rfq.status,
      timestamp: rfq.quoted_at || rfq.received_at,
      route: buildRouteSummary(rfq),
    }));

  return {
    kpis,
    pipeline,
    activity,
    recentRfqs,
  };
}

function readDashboardSummaryFromCache(workspaceId: string): DashboardSummary | null {
  const cached = dashboardSummaryCache.get(workspaceId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    dashboardSummaryCache.delete(workspaceId);
    return null;
  }
  return cached.summary;
}

function writeDashboardSummaryToCache(workspaceId: string, summary: DashboardSummary) {
  dashboardSummaryCache.set(workspaceId, {
    summary,
    expiresAt: Date.now() + DASHBOARD_SUMMARY_CACHE_TTL_MS,
  });
}

export async function getCachedDashboardSummary(options: BuildDashboardSummaryOptions) {
  const cachedSummary = readDashboardSummaryFromCache(options.workspaceId);
  if (cachedSummary) return cachedSummary;

  const summary = await buildDashboardSummary(options);
  writeDashboardSummaryToCache(options.workspaceId, summary);
  return summary;
}

export function clearDashboardSummaryCache(workspaceId?: string) {
  if (!workspaceId) {
    dashboardSummaryCache.clear();
    return;
  }
  dashboardSummaryCache.delete(workspaceId);
}
