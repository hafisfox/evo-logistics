import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateFullPricing } from "@/lib/pricing-engine";
import { getSettings } from "@/lib/settings";
import type { DOCharge } from "@/types/pricing";
import type { Database } from "@/types/supabase";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validatePricingCalculateBody,
  type ApiErrorPayload,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

type DoChargeRow = Database["public"]["Tables"]["do_charges"]["Row"];
type DestinationChargeRow = Database["public"]["Tables"]["destination_charges"]["Row"];
type TransportChargeRow = Database["public"]["Tables"]["transportation_charges"]["Row"];

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
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

    const [doRes, destRes, transpRes, settings] = await Promise.all([
      supabase
        .from("do_charges")
        .select("*")
        .eq("workspace_id", workspaceId),
      supabase
        .from("destination_charges")
        .select("*")
        .eq("workspace_id", workspaceId),
      supabase
        .from("transportation_charges")
        .select("*")
        .eq("workspace_id", workspaceId),
      getSettings(workspaceId),
    ]);

    if (doRes.error) throw doRes.error;
    if (destRes.error) throw destRes.error;
    if (transpRes.error) throw transpRes.error;

    const doCharges = ((doRes.data || []) as DoChargeRow[]).map((item) => ({
      carrier: item.carrier,
      document: Number(item.document),
      "20FT": Number(item["20FT"]),
      "40FT": Number(item["40FT"]),
      "40HQ": Number(item["40HQ"]),
    })) as DOCharge[];

    const mappedDestCharges = ((destRes.data || []) as DestinationChargeRow[]).map((item) => ({
      "Charge Type": item.charge_type,
      Basis: item.basis,
      "20FT": Number(item["20FT"]),
      "40FT": Number(item["40FT"]),
    }));

    const mappedTranspCharges = ((transpRes.data || []) as TransportChargeRow[]).map((item) => ({
      Place: item.place,
      Price: Number(item.price),
    }));

    const result = calculateFullPricing({
      rfq: validation.data.rfq,
      quote: validation.data.quote,
      doCharges,
      destCharges: mappedDestCharges,
      transpCharges: mappedTranspCharges,
      settings: {
        margin: settings.profitMargin / 100,
        quoteThreshold: settings.quoteThreshold,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to calculate pricing:", error);
    return jsonError({ error: "Failed to calculate pricing" }, 500);
  }
}
