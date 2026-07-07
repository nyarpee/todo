import type {
  CreateHabitInput,
  Habit,
  HabitEntry,
  HabitEntryId,
  HabitId,
  HabitUnitType,
} from "@/types/habit";
import { DEFAULT_HABIT_COLOR } from "./habit-colors";

type Clock = () => string;
type IdGenerator = () => string;

const defaultClock: Clock = () => new Date().toISOString();
const defaultIdGenerator: IdGenerator = () => crypto.randomUUID();

type HabitActionOptions = {
  now?: Clock;
  generateId?: IdGenerator;
};

export function addHabit(
  habits: Habit[],
  input: CreateHabitInput,
  options: HabitActionOptions = {},
): Habit[] {
  const now = (options.now ?? defaultClock)();
  const title = input.title.trim();

  if (title.length === 0) {
    throw new Error("Habit title cannot be empty.");
  }

  const unitType = input.unitType ?? "minutes";
  const unitMinutes = unitType === "times" ? 0 : Math.round(input.unitMinutes);

  if (unitType === "minutes" && (!Number.isFinite(unitMinutes) || unitMinutes <= 0)) {
    throw new Error("Habit unit must be greater than 0.");
  }

  return [
    ...habits,
    {
      id: (options.generateId ?? defaultIdGenerator)(),
      userId: input.userId,
      title,
      unitType,
      unitMinutes,
      color: input.color ?? DEFAULT_HABIT_COLOR,
      order: getNextOrder(habits),
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function updateHabit(
  habits: Habit[],
  habitId: HabitId,
  patch: Partial<Pick<Habit, "title" | "unitType" | "unitMinutes" | "color" | "order">>,
  options: Pick<HabitActionOptions, "now"> = {},
): Habit[] {
  const now = (options.now ?? defaultClock)();

  return habits.map((habit) => {
    if (habit.id !== habitId) return habit;

    const title = patch.title === undefined ? habit.title : patch.title.trim();
    const unitType = patch.unitType ?? habit.unitType;
    const unitMinutes = unitType === "times" ? 0 : (patch.unitMinutes ?? habit.unitMinutes);

    if (title.length === 0) {
      throw new Error("Habit title cannot be empty.");
    }

    if (unitType === "minutes" && (!Number.isFinite(unitMinutes) || unitMinutes <= 0)) {
      throw new Error("Habit unit must be greater than 0.");
    }

    return {
      ...habit,
      ...patch,
      title,
      unitType,
      unitMinutes: unitType === "times" ? 0 : Math.round(unitMinutes),
      updatedAt: now,
    };
  });
}

export function deleteHabit(
  habits: Habit[],
  entries: HabitEntry[],
  habitId: HabitId,
): { habits: Habit[]; entries: HabitEntry[] } {
  return {
    habits: habits.filter((habit) => habit.id !== habitId),
    entries: entries.filter((entry) => entry.habitId !== habitId),
  };
}

export function addHabitEntry(
  entries: HabitEntry[],
  habit: Habit,
  options: HabitActionOptions = {},
): HabitEntry[] {
  const now = (options.now ?? defaultClock)();

  return [
    ...entries,
    {
      id: (options.generateId ?? defaultIdGenerator)(),
      habitId: habit.id,
      userId: habit.userId,
      minutes: habit.unitType === "minutes" ? habit.unitMinutes : 0,
      checkedAt: now,
      createdAt: now,
    },
  ];
}

export function removeHabitEntry(
  entries: HabitEntry[],
  entryId: HabitEntryId,
): HabitEntry[] {
  return entries.filter((entry) => entry.id !== entryId);
}

export function reorderHabits(
  habits: Habit[],
  orderedHabitIds: HabitId[],
  options: Pick<HabitActionOptions, "now"> = {},
): Habit[] {
  const now = (options.now ?? defaultClock)();
  const orderById = new Map(orderedHabitIds.map((id, index) => [id, index]));

  return habits.map((habit) => {
    const order = orderById.get(habit.id);
    if (order === undefined || order === habit.order) return habit;

    return {
      ...habit,
      order,
      updatedAt: now,
    };
  });
}

export function rebalanceHabitEntriesForUnit(
  entries: HabitEntry[],
  habit: Habit,
  nextUnitType: HabitUnitType,
  nextUnitMinutes: number,
  options: HabitActionOptions = {},
): HabitEntry[] {
  const habitEntries = entries
    .filter((entry) => entry.habitId === habit.id)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const totalMinutes = habitEntries.reduce((sum, entry) => sum + entry.minutes, 0);
  const nextCount =
    nextUnitType === "times"
      ? habitEntries.length
      : Math.max(0, Math.round(totalMinutes / nextUnitMinutes));
  const now = (options.now ?? defaultClock)();
  const generateId = options.generateId ?? defaultIdGenerator;
  const nextHabitEntries = Array.from({ length: nextCount }, (_, index) => {
    const existingEntry = habitEntries[index] ?? null;

    return {
      id: existingEntry?.id ?? generateId(),
      habitId: habit.id,
      userId: habit.userId,
      minutes: nextUnitType === "minutes" ? nextUnitMinutes : 0,
      checkedAt: existingEntry?.checkedAt ?? now,
      createdAt: existingEntry?.createdAt ?? now,
    };
  });

  return [
    ...entries.filter((entry) => entry.habitId !== habit.id),
    ...nextHabitEntries,
  ];
}

function getNextOrder(habits: Habit[]): number {
  if (habits.length === 0) return 0;
  return Math.max(...habits.map((habit) => habit.order)) + 1;
}
