import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import { isMissingRelationError } from "@/lib/supabase-errors";
import { fetchMarketRates } from "@/lib/modal-client";
import type { ExternalRateQuote } from "@/types/pricing";

export const dynamic = "force-dynamic";

// external_rate_quotes is newer than the generated Database types; cast to bypass typing.
type Db = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
const quotesTable = (supabase: Db) => (supabase.from as any)("external_rate_quotes");

function mapRow(row: Record<string, unknown>): ExternalRateQuote {
  const surcharges = Array.isArray(row.surcharges)
    ? (row.surcharges as { type: string; amount: number }[])
    : [];
  return {
    id: Number(row.id || 0),
    provider: String(row.provider || ""),
    carrier: String(row.carrier || ""),
    origin: String(row.origin || ""),
    destination: String(row.destination || ""),
    equipment_type: row.equipment_type == null ? null : String(row.equipment_type),
    price_usd: Number(row.price_usd || 0),
    currency: String(row.currency || "USD"),
    transit_time_days: row.transit_time_days == null ? null : Number(row.transit_time_days),
    valid_until: row.valid_until == null ? null : String(row.valid_until),
    surcharges,
    source: String(row.source || "api"),
    freight_mode: String(row.freight_mode || "land"),
    created_at: row.created_at == null ? null : String(row.created_at),
  };
}

// GET — list persisted market-rate quotes for the workspace (newest first).
export async function GET() {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await quotesTable(supabase)
      .select("*")
      .eq("workspace_id", scope.context.workspaceId)
      .order("origin", { ascending: true })
      .order("destination", { ascending: true })
      .order("price_usd", { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) return NextResponse.json([]);
      throw error;
    }

    return NextResponse.json(((data || []) as Record<string, unknown>[]).map(mapRow));
  } catch (error) {
    console.error("Failed to fetch market rates:", error);
    return NextResponse.json({ error: "Failed to fetch market rates" }, { status: 500 });
  }
}

// POST — trigger the Modal aggregator to fetch + persist a fresh snapshot for a lane.
export async function POST(request: Request) {
  const scope = await requireWorkspaceApiContext({ allowedRoles: ["owner", "admin"] });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid payload", details: ["Body must be valid JSON."] },
      { status: 400 }
    );
  }

  const origin = String(body.origin || "").trim();
  const destination = String(body.destination || "").trim();
  if (!origin || !destination) {
    return NextResponse.json(
      { error: "Origin and destination are required" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchMarketRates({
      workspace_id: scope.context.workspaceId,
      origin,
      destination,
      freight_mode: body.freight_mode ? String(body.freight_mode) : "land",
      equipment_type: body.equipment_type ? String(body.equipment_type) : null,
      load_type: body.load_type ? String(body.load_type) : null,
      weight_lbs: body.weight_lbs == null ? null : Number(body.weight_lbs),
      nmfc_class: body.nmfc_class ? String(body.nmfc_class) : null,
      rfq_id: body.rfq_id ? String(body.rfq_id) : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to refresh market rates:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh market rates" },
      { status: 502 }
    );
  }
}
