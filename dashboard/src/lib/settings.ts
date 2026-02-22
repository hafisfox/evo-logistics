import { createClient } from "@/lib/supabase/server";

export interface Settings {
  profitMargin: number;
  quoteThreshold: number;
}

export const defaultSettings: Settings = {
  profitMargin: 13,
  quoteThreshold: 2,
};

interface AppSettingsRow {
  key: string;
  value: number;
}

export async function getSettings(): Promise<Settings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value");

    if (error) throw error;

    const rows = (data || []) as unknown as AppSettingsRow[];
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
  updates: Partial<Settings>
): Promise<Settings> {
  const supabase = await createClient();

  const upserts = Object.entries(updates).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("app_settings") as any)
    .upsert(upserts, { onConflict: "key" });

  if (error) throw error;

  return getSettings();
}
