import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import type { ApiErrorPayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function GET() {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const { data, error } = await (supabase.from as any)("exchange_rates")
    .select("id, from_currency, to_currency, rate, effective_date, created_at")
    .eq("workspace_id", scope.context.workspaceId)
    .order("effective_date", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to fetch exchange rates:", error);
    return jsonError({ error: "Failed to fetch exchange rates" }, 500);
  }

  return NextResponse.json(data ?? []);
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
    return jsonError({ error: "Invalid payload", details: ["Body must be valid JSON."] }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError({ error: "Invalid payload", details: ["Body must be a JSON object."] }, 400);
  }

  const record = body as Record<string, unknown>;
  const details: string[] = [];

  const rate = typeof record.rate === "number" && Number.isFinite(record.rate) ? record.rate : null;
  if (rate == null || rate <= 0) {
    details.push("rate must be a positive number.");
  }

  const fromCurrency = typeof record.from_currency === "string" && record.from_currency.trim()
    ? record.from_currency.trim().toUpperCase()
    : "USD";

  const toCurrency = typeof record.to_currency === "string" && record.to_currency.trim()
    ? record.to_currency.trim().toUpperCase()
    : "AED";

  const effectiveDate = typeof record.effective_date === "string" && record.effective_date.trim()
    ? record.effective_date.trim()
    : new Date().toISOString().split("T")[0];

  if (details.length > 0) {
    return jsonError({ error: "Invalid payload", details }, 400);
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const { data, error } = await (supabase.from as any)("exchange_rates")
    .insert({
      workspace_id: scope.context.workspaceId,
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate,
      effective_date: effectiveDate,
    })
    .select("id, from_currency, to_currency, rate, effective_date, created_at")
    .single();

  if (error) {
    console.error("Failed to create exchange rate:", error);
    return jsonError({ error: "Failed to create exchange rate" }, 500);
  }

  return NextResponse.json(data, { status: 201 });
}
