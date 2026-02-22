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

export async function getSettings(): Promise<Settings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("app_settings").select("key, value");

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

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const supabase = await createClient();

  const upserts: AppSettingsInsert[] = [];
  if (typeof updates.profitMargin === "number") {
    upserts.push({
      key: "profitMargin",
      value: updates.profitMargin,
      updated_at: new Date().toISOString(),
    });
  }

  if (typeof updates.quoteThreshold === "number") {
    upserts.push({
      key: "quoteThreshold",
      value: updates.quoteThreshold,
      updated_at: new Date().toISOString(),
    });
  }

  if (upserts.length === 0) {
    return getSettings();
  }

  const { error } = await supabase.from("app_settings").upsert(upserts, {
    onConflict: "key",
  });

  if (error) throw error;

  return getSettings();
}
