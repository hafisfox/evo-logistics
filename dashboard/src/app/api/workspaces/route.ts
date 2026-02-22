import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { listUserWorkspaces } from "@/lib/workspaces";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await listUserWorkspaces(user.id);
  const currentWorkspaceId = (await cookies()).get("workspace_id")?.value ?? null;

  return NextResponse.json({
    workspaces,
    currentWorkspaceId,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const name =
    typeof body === "object" &&
    body !== null &&
    "name" in body &&
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      name,
      slug,
      kind: "team",
      created_by: user.id,
    })
    .select("id, name, slug, kind")
    .single();

  if (workspaceError || !workspace) {
    console.error("Failed to create workspace:", workspaceError);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }

  const memberRes = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
    status: "active",
  });

  if (memberRes.error) {
    console.error("Failed to create workspace owner membership:", memberRes.error);
    return NextResponse.json({ error: "Failed to create workspace membership" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    workspace: {
      workspace_id: workspace.id,
      role: "owner",
      name: workspace.name,
      slug: workspace.slug,
      kind: workspace.kind,
    },
  });
}

