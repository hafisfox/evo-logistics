import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validateAirCarrierCreateBody,
  validateAirCarrierUpdateBody,
  validateIdDeleteBody,
  type ApiErrorPayload,
} from "@/lib/validation";
import { isMissingRelationError } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

// air_carrier_profiles is newer than the generated Database types; cast to bypass typing.
type Db = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
const carrierTable = (supabase: Db) => (supabase.from as any)("air_carrier_profiles");

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
    iata_code: String(row.iata_code || ""),
    name: String(row.name || ""),
    cargo_types: String(row.cargo_types || ""),
    active: Boolean(row.active),
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
    const { data, error } = await carrierTable(supabase)
      .select("*")
      .eq("workspace_id", scope.context.workspaceId)
      .order("iata_code", { ascending: true });

    if (error) {
      // Degrade gracefully if the migration has not been applied yet.
      if (isMissingRelationError(error)) return NextResponse.json([]);
      throw error;
    }

    return NextResponse.json(((data || []) as Record<string, unknown>[]).map(mapRow));
  } catch (error) {
    console.error("Failed to fetch air carriers:", error);
    return NextResponse.json({ error: "Failed to fetch air carriers" }, { status: 500 });
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
    return jsonError({ error: "Invalid air carrier payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateAirCarrierCreateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await carrierTable(supabase)
      .insert({ workspace_id: scope.context.workspaceId, ...validation.data })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "Air carrier with this IATA code already exists" }, 409);
      }
      throw error;
    }

    return NextResponse.json({ success: true, row: mapRow((data || {}) as Record<string, unknown>) });
  } catch (error) {
    console.error("Failed to create air carrier:", error);
    return jsonError({ error: "Failed to create air carrier" }, 500);
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
    return jsonError({ error: "Invalid air carrier payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateAirCarrierUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  const { id, ...updates } = validation.data;

  try {
    const supabase = await createClient();
    const { data, error } = await carrierTable(supabase)
      .update(updates)
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "Air carrier with this IATA code already exists" }, 409);
      }
      if ((error as { code?: string }).code === "PGRST116") {
        return jsonError({ error: "Air carrier not found" }, 404);
      }
      throw error;
    }

    if (!data) return jsonError({ error: "Air carrier not found" }, 404);
    return NextResponse.json({ success: true, row: mapRow(data as Record<string, unknown>) });
  } catch (error) {
    console.error("Failed to update air carrier:", error);
    return jsonError({ error: "Failed to update air carrier" }, 500);
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
    return jsonError({ error: "Invalid air carrier payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateIdDeleteBody(body, "Air carrier");
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { error } = await carrierTable(supabase)
      .delete()
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", validation.data.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete air carrier:", error);
    return jsonError({ error: "Failed to delete air carrier" }, 500);
  }
}
