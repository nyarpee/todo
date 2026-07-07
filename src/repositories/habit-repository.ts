import type { Habit, HabitEntry } from "@/types/habit";
import type { UserId } from "@/types/task";

export type HabitRepository = {
  listHabits(userId: UserId): Promise<Habit[]>;
  saveHabits(userId: UserId, habits: Habit[]): Promise<void>;
  listHabitEntries(userId: UserId): Promise<HabitEntry[]>;
  saveHabitEntries(userId: UserId, entries: HabitEntry[]): Promise<void>;
};
