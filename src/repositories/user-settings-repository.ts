import { DEFAULT_LANGUAGE, getBrowserDefaultLanguage, isAppLanguage } from "@/i18n/messages";
import type { UserSettings } from "@/types/user-settings";

const USER_SETTINGS_STORAGE_KEY = "todoapp.user-settings";

export class LocalUserSettingsRepository {
  loadSettings(): UserSettings {
    if (typeof window === "undefined") {
      return { language: DEFAULT_LANGUAGE };
    }

    const rawValue = window.localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    if (!rawValue) {
      return { language: getBrowserDefaultLanguage() };
    }

    try {
      const parsedValue = JSON.parse(rawValue) as Partial<UserSettings>;
      return {
        language: isAppLanguage(parsedValue.language) ? parsedValue.language : getBrowserDefaultLanguage(),
      };
    } catch {
      return { language: getBrowserDefaultLanguage() };
    }
  }

  saveSettings(settings: UserSettings): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }
}
