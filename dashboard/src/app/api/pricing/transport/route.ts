import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validateIdDeleteBody,
  validateTransportChargeCreateBody,
  validateTransportChargeUpdateBody,
  type ApiErrorPayload,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

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

function mapTransportRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    Place: row.place,
    Price: row.price,
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
  const workspaceId = scope.context.workspaceId;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('transportation_charges')
      .select('*')
      .eq("workspace_id", workspaceId);
    if (error) throw error;

    // Map snake_case columns back to original Google Sheets format expected by frontend
    const mappedData = ((data || []) as Record<string, unknown>[]).map((t) =>
      mapTransportRow(t)
    );

    return NextResponse.json(mappedData);
  } catch (error) {
    console.error("Failed to fetch transport charges:", error);
    return NextResponse.json(
      { error: "Failed to fetch transport charges" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid transport charges payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateTransportChargeCreateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("transportation_charges")
      .insert({
        workspace_id: scope.context.workspaceId,
        ...validation.data,
      })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "Transport charge for this place already exists" }, 409);
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      row: mapTransportRow((data || {}) as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Failed to create transport charge row:", error);
    return jsonError({ error: "Failed to create transport charge row" }, 500);
  }
}

export async function PATCH(request: Request) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid transport charges payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateTransportChargeUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  const { id, ...updates } = validation.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("transportation_charges")
      .update(updates)
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "Transport charge for this place already exists" }, 409);
      }
      if ((error as { code?: string }).code === "PGRST116") {
        return jsonError({ error: "Transport charge row not found" }, 404);
      }
      throw error;
    }

    if (!data) {
      return jsonError({ error: "Transport charge row not found" }, 404);
    }

    return NextResponse.json({
      success: true,
      row: mapTransportRow((data || {}) as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Failed to update transport charge row:", error);
    return jsonError({ error: "Failed to update transport charge row" }, 500);
  }
}

export async function DELETE(request: Request) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid transport charge payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateIdDeleteBody(body, "Transport charge");
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("transportation_charges")
      .delete()
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", validation.data.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete transport charge row:", error);
    return jsonError({ error: "Failed to delete transport charge row" }, 500);
  }
}
