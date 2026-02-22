import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validateDestinationChargeCreateBody,
  validateDestinationChargeUpdateBody,
  validateIdDeleteBody,
  type ApiErrorPayload,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

function mapDestinationRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    "Charge Type": row.charge_type,
    Basis: row.basis,
    "20FT": row["20FT"],
    "40FT": row["40FT"],
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
      .from('destination_charges')
      .select('*')
      .eq("workspace_id", workspaceId);
    if (error) throw error;

    // Map snake_case columns back to original Google Sheets format expected by frontend
    const mappedData = ((data || []) as Record<string, unknown>[]).map((d) =>
      mapDestinationRow(d)
    );

    return NextResponse.json(mappedData);
  } catch (error) {
    console.error("Failed to fetch destination charges:", error);
    return NextResponse.json(
      { error: "Failed to fetch destination charges" },
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
    return jsonError({ error: "Invalid destination charges payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateDestinationChargeCreateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("destination_charges")
      .insert({
        workspace_id: scope.context.workspaceId,
        ...validation.data,
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({
      success: true,
      row: mapDestinationRow((data || {}) as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Failed to create destination charge row:", error);
    return jsonError({ error: "Failed to create destination charge row" }, 500);
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
    return jsonError({ error: "Invalid destination charges payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateDestinationChargeUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  const { id, ...updates } = validation.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("destination_charges")
      .update(updates)
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return jsonError({ error: "Destination charge row not found" }, 404);
      }
      throw error;
    }

    if (!data) {
      return jsonError({ error: "Destination charge row not found" }, 404);
    }

    return NextResponse.json({
      success: true,
      row: mapDestinationRow((data || {}) as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Failed to update destination charge row:", error);
    return jsonError({ error: "Failed to update destination charge row" }, 500);
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
    return jsonError({ error: "Invalid destination charge payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateIdDeleteBody(body, "Destination charge");
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("destination_charges")
      .delete()
      .eq("workspace_id", scope.context.workspaceId)
      .eq("id", validation.data.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete destination charge row:", error);
    return jsonError({ error: "Failed to delete destination charge row" }, 500);
  }
}
