import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validateAirRateCreateBody,
  validateAirRateUpdateBody,
  validateIdDeleteBody,
  type ApiErrorPayload,
} from "@/lib/validation";
import { isMissingRelationError } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

// air_charge_rates is newer than the generated Database types; cast to bypass typing.
type Db = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
const rateTable = (supabase: Db) => (supabase.from as any)("air_charge_rates");

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

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id || 0),
    carrier: String(row.carrier || ""),
    origin: String(row.origin || ""),
    destination: String(row.destination || ""),
    min_weight_kg: Number(row.min_weight_kg || 0),
    rate_per_kg_usd: Number(row.rate_per_kg_usd || 0),
    min_charge_usd: Number(row.min_charge_usd || 0),
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
      .order("origin", { ascending: true })
      .order("destination", { ascending: true })
      .order("min_weight_kg", { ascending: true });

    if (error) {
      // Degrade gracefully if the migration has not been applied yet.
      if (isMissingRelationError(error)) return NextResponse.json([]);
      throw error;
    }

    return NextResponse.json(((data || []) as Record<string, unknown>[]).map(mapRow));
  } catch (error) {
    console.error("Failed to fetch air rates:", error);
    return NextResponse.json({ error: "Failed to fetch air rates" }, { status: 500 });
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
    return jsonError({ error: "Invalid air rate payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateAirRateCreateBody(body);
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
        return jsonError({ error: "A rate for this carrier, lane, and weight tier already exists" }, 409);
      }
      throw error;
    }

    return NextResponse.json({ success: true, row: mapRow((data || {}) as Record<string, unknown>) });
  } catch (error) {
    console.error("Failed to create air rate:", error);
    return jsonError({ error: "Failed to create air rate" }, 500);
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
    return jsonError({ error: "Invalid air rate payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateAirRateUpdateBody(body);
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
        return jsonError({ error: "A rate for this carrier, lane, and weight tier already exists" }, 409);
      }
      if ((error as { code?: string }).code === "PGRST116") {
        return jsonError({ error: "Air rate not found" }, 404);
      }
      throw error;
    }

    if (!data) return jsonError({ error: "Air rate not found" }, 404);
    return NextResponse.json({ success: true, row: mapRow(data as Record<string, unknown>) });
  } catch (error) {
    console.error("Failed to update air rate:", error);
    return jsonError({ error: "Failed to update air rate" }, 500);
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
    return jsonError({ error: "Invalid air rate payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateIdDeleteBody(body, "Air rate");
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
    console.error("Failed to delete air rate:", error);
    return jsonError({ error: "Failed to delete air rate" }, 500);
  }
}
