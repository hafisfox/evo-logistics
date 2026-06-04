import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validateTruckLaneRateCreateBody,
  validateTruckLaneRateUpdateBody,
  validateIdDeleteBody,
  type ApiErrorPayload,
} from "@/lib/validation";
import { isMissingRelationError } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

// truck_lane_rates is newer than the generated Database types; cast to bypass typing.
type Db = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
const rateTable = (supabase: Db) => (supabase.from as any)("truck_lane_rates");

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function numOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id || 0),
    carrier: String(row.carrier || ""),
    origin_zip: String(row.origin_zip || ""),
    destination_zip: String(row.destination_zip || ""),
    equipment_type: String(row.equipment_type || ""),
    rate_per_mile_usd: numOrNull(row.rate_per_mile_usd),
    flat_rate_usd: numOrNull(row.flat_rate_usd),
    min_charge_usd: Number(row.min_charge_usd || 0),
    fuel_surcharge_pct: Number(row.fuel_surcharge_pct || 0),
  };
}

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
    const { data, error } = await rateTable(supabase)
      .select("*")
      .eq("workspace_id", scope.context.workspaceId)
      .order("carrier", { ascending: true })
      .order("origin_zip", { ascending: true })
      .order("destination_zip", { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) return NextResponse.json([]);
      throw error;
    }

    return NextResponse.json(((data || []) as Record<string, unknown>[]).map(mapRow));
  } catch (error) {
    console.error("Failed to fetch lane rates:", error);
    return NextResponse.json({ error: "Failed to fetch lane rates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const scope = await requireWorkspaceApiContext({ allowedRoles: ["owner", "admin"] });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid lane rate payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateTruckLaneRateCreateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await rateTable(supabase)
      .insert({ workspace_id: scope.context.workspaceId, ...validation.data })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "A rate for this carrier, lane, and equipment type already exists" }, 409);
      }
      throw error;
    }

    return NextResponse.json({ success: true, row: mapRow((data || {}) as Record<string, unknown>) });
  } catch (error) {
    console.error("Failed to create lane rate:", error);
    return jsonError({ error: "Failed to create lane rate" }, 500);
  }
}

export async function PATCH(request: Request) {
  const scope = await requireWorkspaceApiContext({ allowedRoles: ["owner", "admin"] });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid lane rate payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateTruckLaneRateUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  const { id, ...updates } = validation.data;

  try {
    const supabase = await createClient();
    const { data, error } = await rateTable(supabase)
      .update(updates)
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "A rate for this carrier, lane, and equipment type already exists" }, 409);
      }
      if ((error as { code?: string }).code === "PGRST116") {
        return jsonError({ error: "Lane rate not found" }, 404);
      }
      throw error;
    }

    if (!data) return jsonError({ error: "Lane rate not found" }, 404);
    return NextResponse.json({ success: true, row: mapRow(data as Record<string, unknown>) });
  } catch (error) {
    console.error("Failed to update lane rate:", error);
    return jsonError({ error: "Failed to update lane rate" }, 500);
  }
}

export async function DELETE(request: Request) {
  const scope = await requireWorkspaceApiContext({ allowedRoles: ["owner", "admin"] });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid lane rate payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateIdDeleteBody(body, "Lane rate");
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { error } = await rateTable(supabase)
      .delete()
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", validation.data.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete lane rate:", error);
    return jsonError({ error: "Failed to delete lane rate" }, 500);
  }
}
