import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_LANGUAGE, isAppLanguage } from "@/i18n/messages";
import type { AppLanguage, UserSettings } from "@/types/user-settings";

type UserSettingsRow = {
  user_id: string;
  language: string;
  created_at: string;
  updated_at: string;
};

export async function pullCloudUserSettings(
  client: SupabaseClient,
  authUserId: string,
): Promise<UserSettings | null> {
  const { data, error } = await client
    .from("user_settings")
    .select("*")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`user_settings select failed: ${formatSupabaseError(error)}`);
  }

  if (!data) return null;
  return rowToUserSettings(data as UserSettingsRow);
}

export async function pushCloudUserSettings(
  client: SupabaseClient,
  authUserId: string,
  settings: UserSettings,
): Promise<void> {
  const { error } = await client.from("user_settings").upsert(
    {
      user_id: authUserId,
      language: settings.language,
    },
    {
      onConflict: "user_id",
    },
  );

  if (error) {
    throw new Error(`user_settings upsert failed: ${formatSupabaseError(error)}`);
  }
}

function rowToUserSettings(row: UserSettingsRow): UserSettings {
  return {
    language: normalizeLanguage(row.language),
  };
}

function normalizeLanguage(language: unknown): AppLanguage {
  return isAppLanguage(language) ? language : DEFAULT_LANGUAGE;
}

function formatSupabaseError(error: { message: string; code?: string; details?: string; hint?: string }): string {
  return [
    error.message,
    error.code ? `code: ${error.code}` : null,
    error.details,
    error.hint,
  ].filter(Boolean).join(" / ");
}
