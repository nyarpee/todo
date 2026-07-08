"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, messages } from "@/i18n/messages";
import { getBrowserSupabaseClient } from "@/lib/supabase-client";
import { pullCloudUserSettings, pushCloudUserSettings } from "@/lib/user-settings-sync";
import { LocalUserSettingsRepository } from "@/repositories/user-settings-repository";
import type { AppLanguage, UserSettings } from "@/types/user-settings";

type LanguageContextValue = {
  language: AppLanguage;
  messages: (typeof messages)[AppLanguage];
  setLanguage: (language: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => new LocalUserSettingsRepository(), []);
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [settings, setSettings] = useState<UserSettings>({ language: DEFAULT_LANGUAGE });
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [syncedAuthUserId, setSyncedAuthUserId] = useState<string | null>(null);
  const latestSettingsRef = useRef(settings);
  const isApplyingCloudSettingsRef = useRef(false);

  useEffect(() => {
    setSettings(repository.loadSettings());
    setHasLoadedSettings(true);
  }, [repository]);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let isActive = true;

    async function loadSession() {
      const { data } = await client.auth.getSession();
      if (isActive) {
        setAuthUserId(data.session?.user.id ?? null);
      }
    }

    void loadSession();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user.id ?? null);
      setSyncedAuthUserId(null);
    });

    return () => {
      isActive = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!hasLoadedSettings || !supabase || !authUserId) return;
    const client = supabase;
    const currentAuthUserId = authUserId;
    let isActive = true;

    async function syncInitialCloudSettings() {
      try {
        const cloudSettings = await pullCloudUserSettings(client, currentAuthUserId);
        if (!isActive) return;

        if (cloudSettings) {
          isApplyingCloudSettingsRef.current = true;
          setSettings(cloudSettings);
          latestSettingsRef.current = cloudSettings;
          window.setTimeout(() => {
            isApplyingCloudSettingsRef.current = false;
          }, 0);
        } else {
          await pushCloudUserSettings(client, currentAuthUserId, latestSettingsRef.current);
        }

        if (isActive) {
          setSyncedAuthUserId(currentAuthUserId);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void syncInitialCloudSettings();

    return () => {
      isActive = false;
    };
  }, [authUserId, hasLoadedSettings, supabase]);

  useEffect(() => {
    if (!hasLoadedSettings) return;
    repository.saveSettings(settings);
    document.documentElement.lang = settings.language;
  }, [hasLoadedSettings, repository, settings]);

  useEffect(() => {
    if (
      !hasLoadedSettings ||
      !supabase ||
      !authUserId ||
      syncedAuthUserId !== authUserId ||
      isApplyingCloudSettingsRef.current
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void pushCloudUserSettings(supabase, authUserId, settings).catch((error) => {
        console.error(error);
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [authUserId, hasLoadedSettings, settings, supabase, syncedAuthUserId]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language: settings.language,
      messages: messages[settings.language],
      setLanguage: (language) => setSettings((currentSettings) => ({ ...currentSettings, language })),
    }),
    [settings.language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider.");
  }

  return context;
}
