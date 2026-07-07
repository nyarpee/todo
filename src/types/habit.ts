import type { UserId } from "./task";

export type HabitId = string;
export type HabitEntryId = string;
export type HabitUnitType = "minutes" | "times";
export type HabitColor =
  | "blue"
  | "cyan"
  | "green"
  | "lime"
  | "yellow"
  | "orange"
  | "red"
  | "pink"
  | "purple"
  | "slate";

export type Habit = {
  id: HabitId;
  userId: UserId;
  title: string;
  unitType: HabitUnitType;
  unitMinutes: number;
  color: HabitColor;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type HabitEntry = {
  id: HabitEntryId;
  habitId: HabitId;
  userId: UserId;
  minutes: number;
  checkedAt: string;
  createdAt: string;
};

export type HabitWithEntries = Habit & {
  entries: HabitEntry[];
  totalMinutes: number;
  totalCount: number;
};

export type CreateHabitInput = {
  userId: UserId;
  title: string;
  unitType?: HabitUnitType;
  unitMinutes: number;
  color?: HabitColor;
};
