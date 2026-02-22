import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type WorkspaceRole = Database["public"]["Tables"]["workspace_members"]["Row"]["role"];
type DoChargeRow = Database["public"]["Tables"]["do_charges"]["Row"];
type DoChargeInsert = Database["public"]["Tables"]["do_charges"]["Insert"];
type DestinationChargeRow = Database["public"]["Tables"]["destination_charges"]["Row"];
type DestinationChargeInsert = Database["public"]["Tables"]["destination_charges"]["Insert"];
type TransportationChargeRow = Database["public"]["Tables"]["transportation_charges"]["Row"];
type TransportationChargeInsert =
  Database["public"]["Tables"]["transportation_charges"]["Insert"];
type AppSettingRow = Database["public"]["Tables"]["app_settings"]["Row"];
type AppSettingInsert = Database["public"]["Tables"]["app_settings"]["Insert"];

export interface UserWorkspace {
  workspace_id: string;
  role: WorkspaceRole;
  name: string;
  slug: string;
  kind: string;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function defaultWorkspaceName(user: User) {
  const fullName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
    user.email?.split("@")[0] ||
    "User";

  return `${fullName} Workspace`;
}

function randomSlugSuffix() {
  return crypto.randomUUID().slice(0, 8);
}

export async function listUserWorkspaces(userId: string): Promise<UserWorkspace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspace:workspaces(name, slug, kind, deleted_at)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;

  const rows = ((data as Array<Record<string, unknown>> | null) ?? []);
  return rows
    .map((row) => {
      const rawWorkspace = row.workspace as Record<string, unknown> | Record<string, unknown>[] | null;
      const workspace = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace;
      if (!workspace || workspace.deleted_at) return null;

      return {
        workspace_id: String(row.workspace_id),
        role: row.role as WorkspaceRole,
        name: typeof workspace.name === "string" ? workspace.name : "Workspace",
        slug: typeof workspace.slug === "string" ? workspace.slug : "",
        kind: typeof workspace.kind === "string" ? workspace.kind : "team",
      } as UserWorkspace;
    })
    .filter((row): row is UserWorkspace => row !== null);
}

export async function setUserDefaultWorkspace(userId: string, workspaceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      default_workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) throw error;
}

async function seedWorkspaceDefaults(targetWorkspaceId: string) {
  const supabase = await createClient();
  const { data: bootstrapWorkspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("is_bootstrap", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!bootstrapWorkspace?.id) return;

  const sourceWorkspaceId = bootstrapWorkspace.id;

  const [doRes, destRes, transpRes, settingsRes] = await Promise.all([
    supabase.from("do_charges").select("*").eq("workspace_id", sourceWorkspaceId),
    supabase.from("destination_charges").select("*").eq("workspace_id", sourceWorkspaceId),
    supabase.from("transportation_charges").select("*").eq("workspace_id", sourceWorkspaceId),
    supabase.from("app_settings").select("*").eq("workspace_id", sourceWorkspaceId),
  ]);

  if (!doRes.error && doRes.data?.length) {
    const sourceRows = doRes.data as DoChargeRow[];
    const rows: DoChargeInsert[] = sourceRows.map((row) => ({
      workspace_id: targetWorkspaceId,
      carrier: row.carrier,
      document: row.document,
      "20FT": row["20FT"],
      "40FT": row["40FT"],
      "40HQ": row["40HQ"],
    }));
    await supabase.from("do_charges").insert(rows);
  }

  if (!destRes.error && destRes.data?.length) {
    const sourceRows = destRes.data as DestinationChargeRow[];
    const rows: DestinationChargeInsert[] = sourceRows.map((row) => ({
      workspace_id: targetWorkspaceId,
      charge_type: row.charge_type,
      basis: row.basis,
      "20FT": row["20FT"],
      "40FT": row["40FT"],
    }));
    await supabase.from("destination_charges").insert(rows);
  }

  if (!transpRes.error && transpRes.data?.length) {
    const sourceRows = transpRes.data as TransportationChargeRow[];
    const rows: TransportationChargeInsert[] = sourceRows.map((row) => ({
      workspace_id: targetWorkspaceId,
      place: row.place,
      price: row.price,
    }));
    await supabase.from("transportation_charges").insert(rows);
  }

  if (!settingsRes.error && settingsRes.data?.length) {
    const sourceRows = settingsRes.data as AppSettingRow[];
    const rows: AppSettingInsert[] = sourceRows.map((row) => ({
      workspace_id: targetWorkspaceId,
      key: row.key,
      value: row.value,
      updated_at: row.updated_at,
    }));
    await supabase.from("app_settings").upsert(rows, {
      onConflict: "workspace_id,key",
    });
  }
}

export async function ensureUserWorkspaceBootstrap(user: User): Promise<string | null> {
  try {
    const supabase = await createClient();
    const existingWorkspaces = await listUserWorkspaces(user.id);
    if (existingWorkspaces.length > 0) {
      const existingDefault = existingWorkspaces[0].workspace_id;
      await setUserDefaultWorkspace(user.id, existingDefault);
      return existingDefault;
    }

    const name = defaultWorkspaceName(user);
    const slug = `${slugify(name)}-${randomSlugSuffix()}`;

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .insert({
        name,
        slug,
        kind: "personal",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (workspaceError || !workspace) {
      console.error("Failed to create personal workspace:", workspaceError);
      return null;
    }

    const membershipResult = await supabase.from("workspace_members").insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
      status: "active",
    });
    if (membershipResult.error) {
      console.error("Failed to create owner membership:", membershipResult.error);
      return null;
    }

    await supabase.from("user_profiles").upsert(
      {
        id: user.id,
        full_name:
          (typeof user.user_metadata?.full_name === "string" &&
            user.user_metadata.full_name) ||
          null,
        default_workspace_id: workspace.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    await seedWorkspaceDefaults(workspace.id);
    return workspace.id;
  } catch (error) {
    console.error("Failed to bootstrap user workspace:", error);
    return null;
  }
}
