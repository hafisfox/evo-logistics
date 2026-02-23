import type { ActivityItem, DashboardKPIs, PipelineCount } from "@/types/analytics";
import type { MasterRFQ } from "@/types/rfq";

export interface DashboardSummary {
  kpis: DashboardKPIs;
  pipeline: PipelineCount[];
  activity: ActivityItem[];
  recentRfqs: MasterRFQ[];
}
