import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceApiContext } from "@/lib/workspace-context";
import type { ApiErrorPayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

function jsonError(payload: ApiErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  const { rfqId } = await params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const { data, error } = await (supabase.from as any)("rfq_notes")
    .select("id, rfq_id, author_id, content, created_at")
    .eq("workspace_id", scope.context.workspaceId)
    .eq("rfq_id", rfqId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch RFQ notes:", error);
    return jsonError({ error: "Failed to fetch notes" }, 500);
  }

  return NextResponse.json(data ?? []);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  const scope = await requireWorkspaceApiContext({
    allowedRoles: ["owner", "admin", "member"],
  });
  if (scope.response) return scope.response;
  if (!scope.context) return jsonError({ error: "Workspace not configured" }, 409);

  const { rfqId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid payload", details: ["Body must be valid JSON."] }, 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("content" in body) ||
    typeof (body as Record<string, unknown>).content !== "string" ||
    (body as Record<string, unknown>).content === ""
  ) {
    return jsonError(
      { error: "Invalid payload", details: ["content is required and must be a non-empty string."] },
      400
    );
  }

  const content = String((body as Record<string, unknown>).content).trim();
  if (content.length > 5000) {
    return jsonError(
      { error: "Invalid payload", details: ["content must be 5000 characters or less."] },
      400
    );
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
  const { data, error } = await (supabase.from as any)("rfq_notes")
    .insert({
      workspace_id: scope.context.workspaceId,
      rfq_id: rfqId,
      author_id: scope.context.userId,
      content,
    })
    .select("id, rfq_id, author_id, content, created_at")
    .single();

  if (error) {
    console.error("Failed to create RFQ note:", error);
    return jsonError({ error: "Failed to create note" }, 500);
  }

  return NextResponse.json(data, { status: 201 });
}
