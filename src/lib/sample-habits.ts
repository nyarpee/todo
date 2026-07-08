import type { Habit } from "@/types/habit";
import type { UserId } from "@/types/task";

export function createSampleHabits(userId: UserId): Habit[] {
  const now = new Date().toISOString();

  return [
    {
      id: crypto.randomUUID(),
      userId,
      title: "Use KizamiTask every day",
      unitType: "times",
      unitMinutes: 0,
      color: "cyan",
      order: 0,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
