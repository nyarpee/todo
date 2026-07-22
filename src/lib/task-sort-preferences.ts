import type { TaskGroupId, UserId } from "@/types/task";
import type { TaskSortMode } from "./task-sort";

const STORAGE_PREFIX = "todoapp.task-sort.v1";

export type TaskSortPreferences = Record<TaskGroupId, TaskSortMode>;

export function loadTaskSortPreferences(workspaceId: UserId): TaskSortPreferences {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}.${workspaceId}`);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, TaskSortMode] => isTaskSortMode(entry[1])),
    );
  } catch {
    return {};
  }
}

export function saveTaskSortPreferences(workspaceId: UserId, preferences: TaskSortPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}.${workspaceId}`, JSON.stringify(preferences));
}

export function isTaskSortMode(value: unknown): value is TaskSortMode {
  return value === "manual" || value === "created" || value === "schedule" || value === "importance";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
