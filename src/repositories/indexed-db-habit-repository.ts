import type { Habit, HabitEntry } from "@/types/habit";
import type { UserId } from "@/types/task";
import type { HabitRepository } from "./habit-repository";
import { INDEXED_DB_STORES, listUserRecords, replaceUserRecords } from "./indexed-db";
import { LocalStorageHabitRepository } from "./local-storage-habit-repository";

export class IndexedDbHabitRepository implements HabitRepository {
  private readonly fallbackRepository = new LocalStorageHabitRepository();

  async listHabits(userId: UserId): Promise<Habit[]> {
    const habits = await listUserRecords<Habit>(INDEXED_DB_STORES.habits, userId);
    if (habits.length > 0) return habits;

    const migratedHabits = await this.fallbackRepository.listHabits(userId);
    if (migratedHabits.length > 0) {
      await this.saveHabits(userId, migratedHabits);
    }

    return migratedHabits;
  }

  async saveHabits(userId: UserId, habits: Habit[]): Promise<void> {
    await replaceUserRecords(INDEXED_DB_STORES.habits, userId, habits);
  }

  async listHabitEntries(userId: UserId): Promise<HabitEntry[]> {
    const entries = await listUserRecords<HabitEntry>(INDEXED_DB_STORES.habitEntries, userId);
    if (entries.length > 0) return entries;

    const migratedEntries = await this.fallbackRepository.listHabitEntries(userId);
    if (migratedEntries.length > 0) {
      await this.saveHabitEntries(userId, migratedEntries);
    }

    return migratedEntries;
  }

  async saveHabitEntries(userId: UserId, entries: HabitEntry[]): Promise<void> {
    await replaceUserRecords(INDEXED_DB_STORES.habitEntries, userId, entries);
  }
}
