import type { FreightMode } from "@/types/rfq";

export interface ModeKpi {
  total: number;
  quoted: number;
  selected: number;
}

export interface DashboardKPIs {
  activeRFQs: number;
  awaitingQuotes: number;
  pendingSelection: number;
  quotedToday: number;
  avgResponseTimeHours: number | null;
  totalRFQs: number;
  selectedCount: number;
  quotedCount: number;
  conversionRate: number;
  totalRevenueAED: number;
  totalRevenueUSD: number;
  modeBreakdown: Record<FreightMode, ModeKpi>;
}

export interface PipelineCount {
  status: string;
  count: number;
}

export interface ActivityItem {
  rfq_id: string;
  customer_email: string;
  status: string;
  timestamp: string;
  route: string;
}
