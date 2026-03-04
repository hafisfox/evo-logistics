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
