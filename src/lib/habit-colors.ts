import type { HabitColor } from "@/types/habit";

export const DEFAULT_HABIT_COLOR: HabitColor = "blue";

export const HABIT_COLORS: Array<{ value: HabitColor; label: string }> = [
  { value: "blue", label: "Blue" },
  { value: "cyan", label: "Cyan" },
  { value: "green", label: "Green" },
  { value: "lime", label: "Lime" },
  { value: "yellow", label: "Yellow" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
  { value: "pink", label: "Pink" },
  { value: "purple", label: "Purple" },
  { value: "slate", label: "Slate" },
];

export function isHabitColor(value: unknown): value is HabitColor {
  return HABIT_COLORS.some((color) => color.value === value);
}
