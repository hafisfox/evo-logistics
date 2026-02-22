import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export interface Settings {
  profitMargin: number;
  quoteThreshold: number;
}

export const defaultSettings: Settings = {
  profitMargin: 13,
  quoteThreshold: 2,
};

type AppSettingsRow = Database["public"]["Tables"]["app_settings"]["Row"];
type AppSettingsInsert = Database["public"]["Tables"]["app_settings"]["Insert"];

export async function getSettings(workspaceId: string): Promise<Settings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("workspace_id", workspaceId);

    if (error) throw error;

    const rows = (data || []) as AppSettingsRow[];
    if (rows.length === 0) return defaultSettings;

    const settings = { ...defaultSettings };
    for (const row of rows) {
      if (row.key === "profitMargin") settings.profitMargin = Number(row.value);
      if (row.key === "quoteThreshold") settings.quoteThreshold = Number(row.value);
    }
    return settings;
  } catch {
    // Fall back to defaults if Supabase is unreachable
    return defaultSettings;
  }
}

export async function updateSettings(
  workspaceId: string,
  updates: Partial<Settings>
): Promise<Settings> {
  const supabase = await createClient();

  const upserts: AppSettingsInsert[] = [];
  if (typeof updates.profitMargin === "number") {
    upserts.push({
      workspace_id: workspaceId,
      key: "profitMargin",
      value: updates.profitMargin,
      updated_at: new Date().toISOString(),
    });
  }

  if (typeof updates.quoteThreshold === "number") {
    upserts.push({
      workspace_id: workspaceId,
      key: "quoteThreshold",
      value: updates.quoteThreshold,
      updated_at: new Date().toISOString(),
    });
  }

  if (upserts.length === 0) {
    return getSettings(workspaceId);
  }

  const { error } = await supabase.from("app_settings").upsert(upserts, {
    onConflict: "workspace_id,key",
  });

  if (error) throw error;

  return getSettings(workspaceId);
}
