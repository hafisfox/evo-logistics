import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validateDOChargeCreateBody,
  validateDOChargeUpdateBody,
  validateIdDeleteBody,
  type ApiErrorPayload,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

interface DoChargeRow {
  id: number;
  carrier: string;
  document: number;
  "20FT": number;
  "40FT": number;
  "40HQ": number;
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

function mapDoRow(row: Record<string, unknown>): DoChargeRow {
  return {
    id: Number(row.id || 0),
    carrier: String(row.carrier || ""),
    document: Number(row.document || 0),
    "20FT": Number(row["20FT"] || 0),
    "40FT": Number(row["40FT"] || 0),
    "40HQ": Number(row["40HQ"] || 0),
  };
}

function buildDoRateRows(profileId: number, payload: { "20FT": number; "40FT": number; "40HQ": number }) {
  return [
    { profile_id: profileId, container_type: "20FT", rate: payload["20FT"] },
    { profile_id: profileId, container_type: "40FT", rate: payload["40FT"] },
    { profile_id: profileId, container_type: "40HQ", rate: payload["40HQ"] },
  ];
}

async function fetchDoRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  profileId?: number
): Promise<DoChargeRow[]> {
  const fromView = await supabase
    .from("v_do_charges_legacy")
    .select('id, carrier, document, "20FT", "40FT", "40HQ"')
    .eq("workspace_id", workspaceId)
    .order("carrier", { ascending: true });

  if (!fromView.error) {
    const rows = ((fromView.data || []) as Record<string, unknown>[]).map(mapDoRow);
    if (typeof profileId === "number") {
      return rows.filter((row) => row.id === profileId);
    }
    return rows;
  }

  if (!isMissingRelationError(fromView.error)) {
    throw fromView.error;
  }

  const profilesRes = await supabase
    .from("do_charge_profiles")
    .select("id, carrier, document")
    .eq("workspace_id", workspaceId)
    .order("carrier", { ascending: true });

  if (!profilesRes.error) {
    const profiles = (profilesRes.data || []) as Array<{
      id: number;
      carrier: string;
      document: number | string;
    }>;
    const filteredProfiles =
      typeof profileId === "number" ? profiles.filter((profile) => profile.id === profileId) : profiles;

    if (filteredProfiles.length === 0) return [];

    const profileIds = filteredProfiles.map((profile) => profile.id);
    const ratesRes = await supabase
      .from("do_charge_rates")
      .select("profile_id, container_type, rate")
      .in("profile_id", profileIds);
    if (ratesRes.error) throw ratesRes.error;

    const rates = (ratesRes.data || []) as Array<{
      profile_id: number;
      container_type: string;
      rate: number | string;
    }>;
    const rateMap = new Map<string, number>();
    for (const rate of rates) {
      rateMap.set(`${rate.profile_id}:${rate.container_type}`, Number(rate.rate || 0));
    }

    return filteredProfiles.map((profile) => ({
      id: profile.id,
      carrier: profile.carrier,
      document: Number(profile.document || 0),
      "20FT": rateMap.get(`${profile.id}:20FT`) || 0,
      "40FT": rateMap.get(`${profile.id}:40FT`) || 0,
      "40HQ": rateMap.get(`${profile.id}:40HQ`) || 0,
    }));
  }

  if (!isMissingRelationError(profilesRes.error)) {
    throw profilesRes.error;
  }

  const legacyRes = await supabase
    .from("do_charges")
    .select('id, carrier, document, "20FT", "40FT", "40HQ"')
    .eq("workspace_id", workspaceId)
    .order("carrier", { ascending: true });
  if (legacyRes.error) throw legacyRes.error;
  const rows = ((legacyRes.data || []) as Record<string, unknown>[]).map(mapDoRow);
  if (typeof profileId === "number") {
    return rows.filter((row) => row.id === profileId);
  }
  return rows;
}

async function createLegacyDoRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  payload: { carrier: string; document: number; "20FT": number; "40FT": number; "40HQ": number }
) {
  const { data, error } = await supabase
    .from("do_charges")
    .insert({
      workspace_id: workspaceId,
      ...payload,
    })
    .select('id, carrier, document, "20FT", "40FT", "40HQ"')
    .single();

  if (error) throw error;
  return mapDoRow((data || {}) as Record<string, unknown>);
}

async function updateLegacyDoRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  id: number,
  updates: Partial<{ carrier: string; document: number; "20FT": number; "40FT": number; "40HQ": number }>
) {
  const { data, error } = await supabase
    .from("do_charges")
    .update(updates)
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select('id, carrier, document, "20FT", "40FT", "40HQ"')
    .single();

  if (error) throw error;
  return mapDoRow((data || {}) as Record<string, unknown>);
}

async function deleteLegacyDoRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  id: number
) {
  const { error } = await supabase
    .from("do_charges")
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
    const rows = await fetchDoRows(supabase, workspaceId);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Failed to fetch DO charges:", error);
    return NextResponse.json({ error: "Failed to fetch DO charges" }, { status: 500 });
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
    return jsonError({ error: "Invalid DO charges payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateDOChargeCreateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const workspaceId = scope.context.workspaceId;

    const profileRes = await supabase
      .from("do_charge_profiles")
      .insert({
        workspace_id: workspaceId,
        carrier: validation.data.carrier,
        document: validation.data.document,
      })
      .select("id")
      .single();

    if (profileRes.error) {
      if (isMissingRelationError(profileRes.error)) {
        const row = await createLegacyDoRow(supabase, workspaceId, validation.data);
        return NextResponse.json({ success: true, row });
      }
      if (isUniqueViolation(profileRes.error)) {
        return jsonError({ error: "DO charge for this carrier already exists" }, 409);
      }
      throw profileRes.error;
    }

    const profileId = Number((profileRes.data as { id: number }).id);
    const ratesRes = await supabase
      .from("do_charge_rates")
      .upsert(buildDoRateRows(profileId, validation.data), { onConflict: "profile_id,container_type" });

    if (ratesRes.error) throw ratesRes.error;

    const rows = await fetchDoRows(supabase, workspaceId, profileId);
    const row = rows[0];
    return NextResponse.json({ success: true, row });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError({ error: "DO charge for this carrier already exists" }, 409);
    }
    console.error("Failed to create DO charge row:", error);
    return jsonError({ error: "Failed to create DO charge row" }, 500);
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
    return jsonError({ error: "Invalid DO charges payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateDOChargeUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  const { id, ...updates } = validation.data;

  try {
    const supabase = await createClient();
    const workspaceId = scope.context.workspaceId;

    const profileLookup = await supabase
      .from("do_charge_profiles")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .single();

    if (profileLookup.error) {
      if (isMissingRelationError(profileLookup.error) || profileLookup.error.code === "PGRST116") {
        try {
          const row = await updateLegacyDoRow(supabase, workspaceId, id, updates);
          return NextResponse.json({ success: true, row });
        } catch (legacyError) {
          if (
            typeof legacyError === "object" &&
            legacyError !== null &&
            "code" in legacyError &&
            (legacyError as { code?: string }).code === "PGRST116"
          ) {
            return jsonError({ error: "DO charge row not found" }, 404);
          }
          if (isUniqueViolation(legacyError)) {
            return jsonError({ error: "DO charge for this carrier already exists" }, 409);
          }
          throw legacyError;
        }
      }
      throw profileLookup.error;
    }

    const profileUpdate: Record<string, unknown> = {};
    if (typeof updates.carrier === "string") profileUpdate.carrier = updates.carrier;
    if (typeof updates.document === "number") profileUpdate.document = updates.document;

    if (Object.keys(profileUpdate).length > 0) {
      const profileUpdateRes = await supabase
        .from("do_charge_profiles")
        .update(profileUpdate)
        .eq("workspace_id", workspaceId)
        .eq("id", id);
      if (profileUpdateRes.error) throw profileUpdateRes.error;
    }

    const ratePayload: Array<{ profile_id: number; container_type: string; rate: number }> = [];
    if (typeof updates["20FT"] === "number") {
      ratePayload.push({ profile_id: id, container_type: "20FT", rate: updates["20FT"] });
    }
    if (typeof updates["40FT"] === "number") {
      ratePayload.push({ profile_id: id, container_type: "40FT", rate: updates["40FT"] });
    }
    if (typeof updates["40HQ"] === "number") {
      ratePayload.push({ profile_id: id, container_type: "40HQ", rate: updates["40HQ"] });
    }

    if (ratePayload.length > 0) {
      const ratesRes = await supabase
        .from("do_charge_rates")
        .upsert(ratePayload, { onConflict: "profile_id,container_type" });
      if (ratesRes.error) throw ratesRes.error;
    }

    const rows = await fetchDoRows(supabase, workspaceId, id);
    const row = rows[0];
    if (!row) {
      return jsonError({ error: "DO charge row not found" }, 404);
    }

    return NextResponse.json({ success: true, row });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError({ error: "DO charge for this carrier already exists" }, 409);
    }
    console.error("Failed to update DO charge row:", error);
    return jsonError({ error: "Failed to update DO charge row" }, 500);
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
    return jsonError({ error: "Invalid DO charge payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateIdDeleteBody(body, "DO charge");
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const workspaceId = scope.context.workspaceId;
    const { id } = validation.data;

    const deleteProfile = await supabase
      .from("do_charge_profiles")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .select("id");

    if (deleteProfile.error) {
      if (isMissingRelationError(deleteProfile.error)) {
        await deleteLegacyDoRow(supabase, workspaceId, id);
        return NextResponse.json({ success: true });
      }
      throw deleteProfile.error;
    }

    if (!deleteProfile.data || deleteProfile.data.length === 0) {
      try {
        await deleteLegacyDoRow(supabase, workspaceId, id);
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
    console.error("Failed to delete DO charge row:", error);
    return jsonError({ error: "Failed to delete DO charge row" }, 500);
  }
}
