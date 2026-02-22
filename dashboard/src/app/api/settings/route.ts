import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { validateSettingsUpdateBody, type ApiErrorPayload } from "@/lib/validation";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function GET() {
  const scope = await requireWorkspaceApiContext();
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  return NextResponse.json(await getSettings(scope.context.workspaceId));
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
    return jsonError({ error: "Invalid settings payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateSettingsUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const newSettings = await updateSettings(
      scope.context.workspaceId,
      validation.data
    );
    return NextResponse.json({ success: true, settings: newSettings });
  } catch (error) {
    console.error("Failed to save settings:", error);
    return jsonError({ error: "Failed to save settings" }, 500);
  }
}
