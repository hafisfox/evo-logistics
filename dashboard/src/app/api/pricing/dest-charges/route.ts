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

interface DestinationRow {
  id: number;
  "Charge Type": string;
  Basis: string;
  "20FT": number;
  "40FT": number;
}

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

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code || "") : "";
  const message =
    "message" in error ? String((error as { message?: string }).message || "") : "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("Could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

function mapDestinationRow(row: Record<string, unknown>): DestinationRow {
  return {
    id: Number(row.id || 0),
    "Charge Type": String(row.charge_type || row["Charge Type"] || ""),
    Basis: String(row.basis || row.Basis || ""),
    "20FT": Number(row["20FT"] || 0),
    "40FT": Number(row["40FT"] || 0),
  };
}

function buildRateRows(itemId: number, payload: { "20FT": number; "40FT": number }) {
  return [
    { item_id: itemId, container_type: "20FT", rate: payload["20FT"] },
    { item_id: itemId, container_type: "40FT", rate: payload["40FT"] },
  ];
}

async function fetchDestinationRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  itemId?: number
) {
  const viewRes = await supabase
    .from("v_destination_charges_legacy")
    .select('id, charge_type, basis, "20FT", "40FT"')
    .eq("workspace_id", workspaceId)
    .order("id", { ascending: true });

  if (!viewRes.error) {
    const rows = ((viewRes.data || []) as Record<string, unknown>[]).map(mapDestinationRow);
    if (typeof itemId === "number") {
      return rows.filter((row) => row.id === itemId);
    }
    return rows;
  }

  if (!isMissingRelationError(viewRes.error)) {
    throw viewRes.error;
  }

  const itemsRes = await supabase
    .from("destination_charge_items")
    .select("id, charge_type, basis")
    .eq("workspace_id", workspaceId)
    .order("id", { ascending: true });

  if (!itemsRes.error) {
    const items = (itemsRes.data || []) as Array<{ id: number; charge_type: string; basis: string }>;
    const filteredItems = typeof itemId === "number" ? items.filter((item) => item.id === itemId) : items;
    if (filteredItems.length === 0) return [];

    const itemIds = filteredItems.map((item) => item.id);
    const ratesRes = await supabase
      .from("destination_charge_rates")
      .select("item_id, container_type, rate")
      .in("item_id", itemIds);
    if (ratesRes.error) throw ratesRes.error;

    const rates = (ratesRes.data || []) as Array<{
      item_id: number;
      container_type: string;
      rate: number | string;
    }>;
    const rateMap = new Map<string, number>();
    for (const rate of rates) {
      rateMap.set(`${rate.item_id}:${rate.container_type}`, Number(rate.rate || 0));
    }

    return filteredItems.map((item) => ({
      id: item.id,
      "Charge Type": item.charge_type,
      Basis: item.basis,
      "20FT": rateMap.get(`${item.id}:20FT`) || 0,
      "40FT": rateMap.get(`${item.id}:40FT`) || 0,
    }));
  }

  if (!isMissingRelationError(itemsRes.error)) {
    throw itemsRes.error;
  }

  const legacyRes = await supabase
    .from("destination_charges")
    .select('id, charge_type, basis, "20FT", "40FT"')
    .eq("workspace_id", workspaceId)
    .order("id", { ascending: true });
  if (legacyRes.error) throw legacyRes.error;
  const rows = ((legacyRes.data || []) as Record<string, unknown>[]).map(mapDestinationRow);
  if (typeof itemId === "number") {
    return rows.filter((row) => row.id === itemId);
  }
  return rows;
}

async function createLegacyDestinationRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  payload: { charge_type: string; basis: string; "20FT": number; "40FT": number }
) {
  const { data, error } = await supabase
    .from("destination_charges")
    .insert({
      workspace_id: workspaceId,
      ...payload,
    })
    .select('id, charge_type, basis, "20FT", "40FT"')
    .single();
  if (error) throw error;
  return mapDestinationRow((data || {}) as Record<string, unknown>);
}

async function updateLegacyDestinationRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  id: number,
  updates: Partial<{ charge_type: string; basis: string; "20FT": number; "40FT": number }>
) {
  const { data, error } = await supabase
    .from("destination_charges")
    .update(updates)
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select('id, charge_type, basis, "20FT", "40FT"')
    .single();
  if (error) throw error;
  return mapDestinationRow((data || {}) as Record<string, unknown>);
}

async function deleteLegacyDestinationRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  id: number
) {
  const { error } = await supabase
    .from("destination_charges")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", id);
  if (error) throw error;
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
    const rows = await fetchDestinationRows(supabase, workspaceId);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to fetch destination charges:", error);
    return NextResponse.json({ error: "Failed to fetch destination charges" }, { status: 500 });
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
    return jsonError(
      { error: "Invalid destination charges payload", details: ["Body must be valid JSON."] },
      400
    );
  }

  const validation = validateDestinationChargeCreateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const workspaceId = scope.context.workspaceId;

    const itemRes = await supabase
      .from("destination_charge_items")
      .insert({
        workspace_id: workspaceId,
        charge_type: validation.data.charge_type,
        basis: validation.data.basis,
      })
      .select("id")
      .single();

    if (itemRes.error) {
      if (isMissingRelationError(itemRes.error)) {
        const row = await createLegacyDestinationRow(supabase, workspaceId, validation.data);
        return NextResponse.json({ success: true, row });
      }
      if (isUniqueViolation(itemRes.error)) {
        return jsonError({ error: "Destination charge row already exists" }, 409);
      }
      throw itemRes.error;
    }

    const itemId = Number((itemRes.data as { id: number }).id);
    const ratesRes = await supabase
      .from("destination_charge_rates")
      .upsert(buildRateRows(itemId, validation.data), { onConflict: "item_id,container_type" });
    if (ratesRes.error) throw ratesRes.error;

    const rows = await fetchDestinationRows(supabase, workspaceId, itemId);
    const row = rows[0];
    return NextResponse.json({ success: true, row });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError({ error: "Destination charge row already exists" }, 409);
    }
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
    return jsonError(
      { error: "Invalid destination charges payload", details: ["Body must be valid JSON."] },
      400
    );
  }

  const validation = validateDestinationChargeUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  const { id, ...updates } = validation.data;

  try {
    const supabase = await createClient();
    const workspaceId = scope.context.workspaceId;

    const itemLookup = await supabase
      .from("destination_charge_items")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .single();

    if (itemLookup.error) {
      if (isMissingRelationError(itemLookup.error) || itemLookup.error.code === "PGRST116") {
        try {
          const row = await updateLegacyDestinationRow(supabase, workspaceId, id, updates);
          return NextResponse.json({ success: true, row });
        } catch (legacyError) {
          if (
            typeof legacyError === "object" &&
            legacyError !== null &&
            "code" in legacyError &&
            (legacyError as { code?: string }).code === "PGRST116"
          ) {
            return jsonError({ error: "Destination charge row not found" }, 404);
          }
          throw legacyError;
        }
      }
      throw itemLookup.error;
    }

    const itemUpdate: Record<string, unknown> = {};
    if (typeof updates.charge_type === "string") itemUpdate.charge_type = updates.charge_type;
    if (typeof updates.basis === "string") itemUpdate.basis = updates.basis;

    if (Object.keys(itemUpdate).length > 0) {
      const itemUpdateRes = await supabase
        .from("destination_charge_items")
        .update(itemUpdate)
        .eq("workspace_id", workspaceId)
        .eq("id", id);
      if (itemUpdateRes.error) throw itemUpdateRes.error;
    }

    const ratePayload: Array<{ item_id: number; container_type: string; rate: number }> = [];
    if (typeof updates["20FT"] === "number") {
      ratePayload.push({ item_id: id, container_type: "20FT", rate: updates["20FT"] });
    }
    if (typeof updates["40FT"] === "number") {
      ratePayload.push({ item_id: id, container_type: "40FT", rate: updates["40FT"] });
    }

    if (ratePayload.length > 0) {
      const ratesRes = await supabase
        .from("destination_charge_rates")
        .upsert(ratePayload, { onConflict: "item_id,container_type" });
      if (ratesRes.error) throw ratesRes.error;
    }

    const rows = await fetchDestinationRows(supabase, workspaceId, id);
    const row = rows[0];
    if (!row) {
      return jsonError({ error: "Destination charge row not found" }, 404);
    }
    return NextResponse.json({ success: true, row });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError({ error: "Destination charge row already exists" }, 409);
    }
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
    return jsonError(
      { error: "Invalid destination charge payload", details: ["Body must be valid JSON."] },
      400
    );
  }

  const validation = validateIdDeleteBody(body, "Destination charge");
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const workspaceId = scope.context.workspaceId;
    const { id } = validation.data;

    const deleteItemRes = await supabase
      .from("destination_charge_items")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .select("id");

    if (deleteItemRes.error) {
      if (isMissingRelationError(deleteItemRes.error)) {
        await deleteLegacyDestinationRow(supabase, workspaceId, id);
        return NextResponse.json({ success: true });
      }
      throw deleteItemRes.error;
    }

    if (!deleteItemRes.data || deleteItemRes.data.length === 0) {
      try {
        await deleteLegacyDestinationRow(supabase, workspaceId, id);
      } catch (legacyError) {
        if (
          !(
            typeof legacyError === "object" &&
            legacyError !== null &&
            "code" in legacyError &&
            (legacyError as { code?: string }).code === "PGRST116"
          )
        ) {
          throw legacyError;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete destination charge row:", error);
    return jsonError({ error: "Failed to delete destination charge row" }, 500);
  }
}
