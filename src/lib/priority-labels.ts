import {
  DEFAULT_PRIORITY_LABELS,
  type PriorityLabels,
} from "@/lib/priority";
import type { TaskPriority } from "@/types/task";

const STORAGE_KEY = "todoapp.priorityLabels.v1";

export function loadPriorityLabels(): PriorityLabels {
  if (typeof window === "undefined") return DEFAULT_PRIORITY_LABELS;

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) return DEFAULT_PRIORITY_LABELS;

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isRecord(parsedValue)) return DEFAULT_PRIORITY_LABELS;

    return {
      high: getLabel(parsedValue.high, DEFAULT_PRIORITY_LABELS.high),
      medium: getLabel(parsedValue.medium, DEFAULT_PRIORITY_LABELS.medium),
      low: getLabel(parsedValue.low, DEFAULT_PRIORITY_LABELS.low),
      none: getLabel(parsedValue.none, DEFAULT_PRIORITY_LABELS.none),
    };
  } catch {
    return DEFAULT_PRIORITY_LABELS;
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
