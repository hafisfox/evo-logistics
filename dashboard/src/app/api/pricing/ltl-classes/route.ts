import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validateLtlClassCreateBody,
  validateLtlClassUpdateBody,
  validateIdDeleteBody,
  type ApiErrorPayload,
} from "@/lib/validation";
import { isMissingRelationError } from "@/lib/supabase-errors";

export const dynamic = "force-dynamic";

// ltl_freight_classes is newer than the generated Database types; cast to bypass typing.
type Db = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
const classTable = (supabase: Db) => (supabase.from as any)("ltl_freight_classes");

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
    nmfc_class: String(row.nmfc_class || ""),
    description: String(row.description || ""),
    min_density: numOrNull(row.min_density),
    max_density: numOrNull(row.max_density),
    rate_per_100lb_usd: Number(row.rate_per_100lb_usd || 0),
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
    const { data, error } = await classTable(supabase)
      .select("*")
      .eq("workspace_id", scope.context.workspaceId)
      .order("nmfc_class", { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) return NextResponse.json([]);
      throw error;
    }

    return NextResponse.json(((data || []) as Record<string, unknown>[]).map(mapRow));
  } catch (error) {
    console.error("Failed to fetch LTL classes:", error);
    return NextResponse.json({ error: "Failed to fetch LTL classes" }, { status: 500 });
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
    return jsonError({ error: "Invalid LTL class payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateLtlClassCreateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await classTable(supabase)
      .insert({ workspace_id: scope.context.workspaceId, ...validation.data })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "This NMFC class already exists" }, 409);
      }
      throw error;
    }

    return NextResponse.json({ success: true, row: mapRow((data || {}) as Record<string, unknown>) });
  } catch (error) {
    console.error("Failed to create LTL class:", error);
    return jsonError({ error: "Failed to create LTL class" }, 500);
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
    return jsonError({ error: "Invalid LTL class payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateLtlClassUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  const { id, ...updates } = validation.data;

  try {
    const supabase = await createClient();
    const { data, error } = await classTable(supabase)
      .update(updates)
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "This NMFC class already exists" }, 409);
      }
      if ((error as { code?: string }).code === "PGRST116") {
        return jsonError({ error: "LTL class not found" }, 404);
      }
      throw error;
    }

    if (!data) return jsonError({ error: "LTL class not found" }, 404);
    return NextResponse.json({ success: true, row: mapRow(data as Record<string, unknown>) });
  } catch (error) {
    console.error("Failed to update LTL class:", error);
    return jsonError({ error: "Failed to update LTL class" }, 500);
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
    return jsonError({ error: "Invalid LTL class payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateIdDeleteBody(body, "LTL class");
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { error } = await classTable(supabase)
      .delete()
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", validation.data.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete LTL class:", error);
    return jsonError({ error: "Failed to delete LTL class" }, 500);
  }
}
