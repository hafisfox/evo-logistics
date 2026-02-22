import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceMembershipSelection {
  workspaceId: string;
  role: WorkspaceRole;
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  workspaceKind?: string | null;
}

export interface WorkspaceApiContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  workspaceKind?: string | null;
}

interface RequireWorkspaceApiContextOptions {
  allowedRoles?: WorkspaceRole[];
  allowNoWorkspace?: boolean;
}

export function pickWorkspaceMembership(
  memberships: WorkspaceMembershipSelection[],
  preferredWorkspaceId: string | null,
  defaultWorkspaceId: string | null
): WorkspaceMembershipSelection | null {
  if (memberships.length === 0) return null;

  if (preferredWorkspaceId) {
    const preferred = memberships.find((m) => m.workspaceId === preferredWorkspaceId);
    if (preferred) return preferred;
  }

  if (defaultWorkspaceId) {
    const defaultMembership = memberships.find((m) => m.workspaceId === defaultWorkspaceId);
    if (defaultMembership) return defaultMembership;
  }

  return memberships[0] ?? null;
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function requireWorkspaceApiContext(
  options: RequireWorkspaceApiContextOptions = {}
): Promise<{ context?: WorkspaceApiContext; response?: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { response: unauthorizedResponse() };
  }

  const [profileRes, membershipsRes] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("default_workspace_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("workspace_id, role, workspace:workspaces(name, slug, kind, deleted_at)")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  if (membershipsRes.error) {
    console.error("Failed to load workspace memberships:", membershipsRes.error);
    return { response: unauthorizedResponse() };
  }

  const defaultWorkspaceId = profileRes.data?.default_workspace_id ?? null;
  const cookieWorkspaceId = (await cookies()).get("workspace_id")?.value ?? null;

  const membershipRows =
    ((membershipsRes.data as Array<Record<string, unknown>> | null) ?? []);

  const memberships: WorkspaceMembershipSelection[] = membershipRows
    .map<WorkspaceMembershipSelection | null>((row) => {
      const rawWorkspace = row.workspace as Record<string, unknown> | Record<string, unknown>[] | null;
      const workspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace;
      if (!workspace || workspace.deleted_at) return null;

      return {
        workspaceId: String(row.workspace_id),
        role: row.role as WorkspaceRole,
        workspaceName: typeof workspace.name === "string" ? workspace.name : null,
        workspaceSlug: typeof workspace.slug === "string" ? workspace.slug : null,
        workspaceKind: typeof workspace.kind === "string" ? workspace.kind : null,
      };
    })
    .filter((row): row is WorkspaceMembershipSelection => Boolean(row));

  const selected = pickWorkspaceMembership(
    memberships,
    cookieWorkspaceId,
    defaultWorkspaceId
  );

  if (!selected) {
    if (options.allowNoWorkspace) return {};
    return {
      response: NextResponse.json(
        { error: "Workspace not configured", onboarding_required: true },
        { status: 409 }
      ),
    };
  }

  if (options.allowedRoles?.length && !options.allowedRoles.includes(selected.role)) {
    return { response: forbiddenResponse() };
  }

  return {
    context: {
      userId: user.id,
      workspaceId: selected.workspaceId,
      role: selected.role,
      workspaceName: selected.workspaceName,
      workspaceSlug: selected.workspaceSlug,
      workspaceKind: selected.workspaceKind,
    },
  };
}

export function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export async function requireWorkspaceMembership(
  workspaceId: string,
  allowedRoles: WorkspaceRole[] = ["owner", "admin", "member"]
): Promise<{ context?: WorkspaceApiContext; response?: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { response: unauthorizedResponse() };
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(name, slug, kind, deleted_at)")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return { response: forbiddenResponse() };
  }

  const membershipRow = data as Record<string, unknown>;
  const role = membershipRow.role as WorkspaceRole;
  if (!allowedRoles.includes(role)) {
    return { response: forbiddenResponse() };
  }

  const rawWorkspace = membershipRow.workspace as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;
  const workspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace;
  if (!workspace || workspace.deleted_at) {
    return { response: forbiddenResponse() };
  }

  return {
    context: {
      userId: user.id,
      workspaceId,
      role,
      workspaceName: typeof workspace.name === "string" ? workspace.name : null,
      workspaceSlug: typeof workspace.slug === "string" ? workspace.slug : null,
      workspaceKind: typeof workspace.kind === "string" ? workspace.kind : null,
    },
  };
}
