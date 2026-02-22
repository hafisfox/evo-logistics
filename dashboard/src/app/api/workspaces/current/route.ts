import { NextResponse } from "next/server";

import {
  requireWorkspaceApiContext,
  requireWorkspaceMembership,
} from "@/lib/workspace-context";

export async function GET() {
  const scope = await requireWorkspaceApiContext({ allowNoWorkspace: true });
  if (scope.response) return scope.response;
  if (!scope.context) {
    return NextResponse.json(
      { error: "Workspace not configured", onboarding_required: true },
      { status: 409 }
    );
  }

  return NextResponse.json({
    workspaceId: scope.context.workspaceId,
    role: scope.context.role,
    workspaceName: scope.context.workspaceName,
    workspaceSlug: scope.context.workspaceSlug,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const workspaceId =
    typeof body === "object" &&
    body !== null &&
    "workspace_id" in body &&
    typeof body.workspace_id === "string"
      ? body.workspace_id
      : null;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  const access = await requireWorkspaceMembership(workspaceId);
  if (access.response) return access.response;
  if (!access.context) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const response = NextResponse.json({
    success: true,
    workspaceId,
    role: access.context.role,
  });

  response.cookies.set("workspace_id", workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
