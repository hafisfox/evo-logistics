import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import {
  validateAgentCreateBody,
  validateAgentDeleteBody,
  validateAgentUpdateBody,
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
      .from('agents')
      .select('*')
      .eq("workspace_id", workspaceId);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
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
    return jsonError({ error: "Invalid agent payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateAgentCreateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("agents")
      .insert({
        workspace_id: scope.context.workspaceId,
        ...validation.data,
      })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "Agent already exists" }, 409);
      }
      throw error;
    }

    return NextResponse.json({ success: true, agent: data });
  } catch (error) {
    console.error("Failed to create agent:", error);
    return jsonError({ error: "Failed to create agent" }, 500);
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
    return jsonError({ error: "Invalid agent payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateAgentUpdateBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  const { current_agent_name, ...updates } = validation.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("agents")
      .update(updates)
      .eq("workspace_id", scope.context.workspaceId)
      .eq("agent_name", current_agent_name)
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return jsonError({ error: "Agent already exists" }, 409);
      }

      if ((error as { code?: string }).code === "PGRST116") {
        return jsonError({ error: "Agent not found" }, 404);
      }

      throw error;
    }

    if (!data) {
      return jsonError({ error: "Agent not found" }, 404);
    }

    return NextResponse.json({ success: true, agent: data });
  } catch (error) {
    console.error("Failed to update agent:", error);
    return jsonError({ error: "Failed to update agent" }, 500);
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
    return jsonError({ error: "Invalid agent payload", details: ["Body must be valid JSON."] }, 400);
  }

  const validation = validateAgentDeleteBody(body);
  if (!validation.success) {
    return jsonError({ error: validation.error, details: validation.details }, 400);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("agents")
      .delete()
      .eq("workspace_id", scope.context.workspaceId)
      .eq("agent_name", validation.data.agent_name);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return jsonError({ error: "Failed to delete agent" }, 500);
  }
}
