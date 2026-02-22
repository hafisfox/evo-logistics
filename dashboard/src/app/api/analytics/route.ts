import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DashboardKPIs, PipelineCount, ActivityItem } from "@/types/analytics";
import type { MasterRFQ, AgentQuote } from "@/types/rfq";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all RFQs and Quotes in parallel from Supabase
    const [rfqsRes, quotesRes] = await Promise.all([
      supabase.from('master_rfqs').select('rfq_id, status, received_at, quoted_at, customer_email, pol, pod'),
      supabase.from('agent_outbound_log').select('rfq_id, status')
    ]);

    if (rfqsRes.error) throw rfqsRes.error;
    if (quotesRes.error) throw quotesRes.error;

    const rfqs = (rfqsRes.data || []) as Partial<MasterRFQ>[];
    const quotes = (quotesRes.data || []) as Partial<AgentQuote>[];
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

    const kpis: DashboardKPIs = {
      activeRFQs,
      awaitingQuotes,
      pendingSelection,
      quotedToday,
      avgResponseTimeHours,
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
        route: `${r.pol} → ${r.pod}`,
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
