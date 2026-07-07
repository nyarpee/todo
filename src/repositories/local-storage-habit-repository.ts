import type { Habit, HabitEntry } from "@/types/habit";
import type { UserId } from "@/types/task";
import { DEFAULT_HABIT_COLOR, isHabitColor } from "@/lib/habit-colors";
import type { HabitRepository } from "./habit-repository";

const HABITS_STORAGE_KEY_PREFIX = "todoapp.habits.v1";
const ENTRIES_STORAGE_KEY_PREFIX = "todoapp.habit-entries.v1";

export class LocalStorageHabitRepository implements HabitRepository {
  async listHabits(userId: UserId): Promise<Habit[]> {
    const rawValue = window.localStorage.getItem(getHabitsStorageKey(userId));
    if (!rawValue) return [];

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      throw new Error("Stored habits are invalid.");
    }

    return parsedValue.map(assertHabit);
  }

  async saveHabits(userId: UserId, habits: Habit[]): Promise<void> {
    window.localStorage.setItem(getHabitsStorageKey(userId), JSON.stringify(habits));
  }

  async listHabitEntries(userId: UserId): Promise<HabitEntry[]> {
    const rawValue = window.localStorage.getItem(getEntriesStorageKey(userId));
    if (!rawValue) return [];

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      throw new Error("Stored habit entries are invalid.");
    }

    return parsedValue.map(assertHabitEntry);
  }

  async saveHabitEntries(userId: UserId, entries: HabitEntry[]): Promise<void> {
    window.localStorage.setItem(getEntriesStorageKey(userId), JSON.stringify(entries));
  }
}

function getHabitsStorageKey(userId: UserId): string {
  return `${HABITS_STORAGE_KEY_PREFIX}.${userId}`;
}

function getEntriesStorageKey(userId: UserId): string {
  return `${ENTRIES_STORAGE_KEY_PREFIX}.${userId}`;
}

function assertHabit(value: unknown): Habit {
  if (!isRecord(value)) {
    throw new Error("Stored habit is invalid.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.title !== "string" ||
    typeof value.unitMinutes !== "number" ||
    typeof value.order !== "number" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Stored habit is invalid.");
  }

  return {
    id: value.id,
    userId: value.userId,
    title: value.title,
    unitType: value.unitType === "times" ? "times" : "minutes",
    unitMinutes: value.unitMinutes,
    color: isHabitColor(value.color) ? value.color : DEFAULT_HABIT_COLOR,
    order: value.order,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function assertHabitEntry(value: unknown): HabitEntry {
  if (!isRecord(value)) {
    throw new Error("Stored habit entry is invalid.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.habitId !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.minutes !== "number" ||
    typeof value.checkedAt !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("Stored habit entry is invalid.");
  }

  return {
    id: value.id,
    habitId: value.habitId,
    userId: value.userId,
    minutes: value.minutes,
    checkedAt: value.checkedAt,
    createdAt: value.createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
