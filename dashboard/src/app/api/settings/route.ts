import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { validateSettingsUpdateBody, type ApiErrorPayload } from "@/lib/validation";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid settings payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateSettingsUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const newSettings = await updateSettings(validation.data);
    return NextResponse.json({ success: true, settings: newSettings });
  } catch (error) {
    console.error("Failed to save settings:", error);
    return jsonError({ error: "Failed to save settings" }, 500);
  }
}
