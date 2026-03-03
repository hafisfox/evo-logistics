import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateFullPricing } from "@/lib/pricing-engine";
import { getSettings } from "@/lib/settings";
import type { DOCharge } from "@/types/pricing";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validatePricingCalculateBody,
  type ApiErrorPayload,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
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

async function fetchDoCharges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<DOCharge[]> {
  const fromView = await supabase
    .from("v_do_charges_legacy")
    .select('carrier, document, "20FT", "40FT", "40HQ"')
    .eq("workspace_id", workspaceId);

  if (!fromView.error) {
    return ((fromView.data || []) as Record<string, unknown>[]).map((item) => ({
      carrier: String(item.carrier || ""),
      document: Number(item.document || 0),
      "20FT": Number(item["20FT"] || 0),
      "40FT": Number(item["40FT"] || 0),
      "40HQ": Number(item["40HQ"] || 0),
    }));
  }

  if (!isMissingRelationError(fromView.error)) {
    throw fromView.error;
  }

  const legacyRes = await supabase
    .from("do_charges")
    .select('carrier, document, "20FT", "40FT", "40HQ"')
    .eq("workspace_id", workspaceId);
  if (legacyRes.error) throw legacyRes.error;

  return ((legacyRes.data || []) as Record<string, unknown>[]).map((item) => ({
    carrier: String(item.carrier || ""),
    document: Number(item.document || 0),
    "20FT": Number(item["20FT"] || 0),
    "40FT": Number(item["40FT"] || 0),
    "40HQ": Number(item["40HQ"] || 0),
  }));
}

async function fetchDestinationCharges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
) {
  const fromView = await supabase
    .from("v_destination_charges_legacy")
    .select('charge_type, basis, "20FT", "40FT"')
    .eq("workspace_id", workspaceId);

  if (!fromView.error) {
    return ((fromView.data || []) as Record<string, unknown>[]).map((item) => ({
      "Charge Type": String(item.charge_type || ""),
      Basis: String(item.basis || ""),
      "20FT": Number(item["20FT"] || 0),
      "40FT": Number(item["40FT"] || 0),
    }));
  }

  if (!isMissingRelationError(fromView.error)) {
    throw fromView.error;
  }

  const legacyRes = await supabase
    .from("destination_charges")
    .select('charge_type, basis, "20FT", "40FT"')
    .eq("workspace_id", workspaceId);
  if (legacyRes.error) throw legacyRes.error;

  return ((legacyRes.data || []) as Record<string, unknown>[]).map((item) => ({
    "Charge Type": String(item.charge_type || ""),
    Basis: String(item.basis || ""),
    "20FT": Number(item["20FT"] || 0),
    "40FT": Number(item["40FT"] || 0),
  }));
}

export async function POST(request: Request) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);
  const workspaceId = scope.context.workspaceId;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid pricing payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validatePricingCalculateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();

    const [doCharges, mappedDestCharges, transpRes, fxRes, settings] = await Promise.all([
      fetchDoCharges(supabase, workspaceId),
      fetchDestinationCharges(supabase, workspaceId),
      supabase
        .from("transportation_charges")
        .select("*")
        .eq("workspace_id", workspaceId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
      (supabase.from as any)("exchange_rates")
        .select("rate")
        .eq("workspace_id", workspaceId)
        .eq("from_currency", "USD")
        .eq("to_currency", "AED")
        .order("effective_date", { ascending: false })
        .limit(1),
      getSettings(workspaceId),
    ]);

    if (transpRes.error) throw transpRes.error;

    const mappedTranspCharges = ((transpRes.data || []) as Record<string, unknown>[]).map(
      (item) => ({
        Place: String(item.place || ""),
        Price: Number(item.price || 0),
      })
    );

    // Get exchange rate from DB or fall back to default
    const fxData = fxRes.data as Array<{ rate: number }> | null;
    const exchangeRate =
      fxData && fxData.length > 0
        ? Number(fxData[0].rate)
        : undefined;

    const result = calculateFullPricing({
      rfq: validation.data.rfq,
      quote: validation.data.quote,
      doCharges,
      destCharges: mappedDestCharges,
      transpCharges: mappedTranspCharges,
      settings: {
        margin: settings.profitMargin / 100,
        quoteThreshold: settings.quoteThreshold,
        exchangeRate,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to calculate pricing:", error);
    return jsonError({ error: "Failed to calculate pricing" }, 500);
  }
}
