import type { Habit } from "@/types/habit";
import type { UserId } from "@/types/task";
import type { AppLanguage } from "@/types/user-settings";

export function createSampleHabits(userId: UserId, language: AppLanguage = "en"): Habit[] {
  const now = new Date().toISOString();

  return [
    {
      id: crypto.randomUUID(),
      userId,
      title: SAMPLE_HABIT_TITLES[language] ?? SAMPLE_HABIT_TITLES.en,
      unitType: "times",
      unitMinutes: 0,
      color: "cyan",
      order: 0,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

const SAMPLE_HABIT_TITLES: Record<AppLanguage, string> = {
  en: "Use KizamiTask every day",
  ja: "毎日 KizamiTask を使う",
  "zh-CN": "每天使用 KizamiTask",
  "zh-TW": "每天使用 KizamiTask",
};
