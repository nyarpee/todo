import {
  DEFAULT_PRIORITY_LABELS,
  type PriorityLabels,
} from "@/lib/priority";
import type { TaskPriority } from "@/types/task";

const STORAGE_KEY = "todoapp.priorityLabels.v1";

export function loadPriorityLabels(defaultLabels: PriorityLabels = DEFAULT_PRIORITY_LABELS): PriorityLabels {
  if (typeof window === "undefined") return defaultLabels;

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) return defaultLabels;

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isRecord(parsedValue)) return defaultLabels;

    return {
      high: getLabel(parsedValue.high, defaultLabels.high),
      medium: getLabel(parsedValue.medium, defaultLabels.medium),
      low: getLabel(parsedValue.low, defaultLabels.low),
      none: getLabel(parsedValue.none, defaultLabels.none),
    };
  } catch {
    return defaultLabels;
  }
}

export function savePriorityLabels(labels: PriorityLabels): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  window.dispatchEvent(new CustomEvent(PRIORITY_LABELS_EVENT));
}

export const PRIORITY_LABELS_EVENT = "todoapp:priority-labels";

function getLabel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function isRecord(value: unknown): value is Partial<Record<TaskPriority, unknown>> {
  return typeof value === "object" && value !== null;
}
