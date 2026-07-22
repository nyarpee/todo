import type { ComposeDraft } from "@/types/compose-session";
import type { TaskNode } from "@/types/task";

export type TaskSortMode = "manual" | "created" | "schedule" | "importance";

const PRIORITY_RANK: Record<TaskNode["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export function sortTaskRoots(roots: TaskNode[], mode: TaskSortMode): TaskNode[] {
  if (mode === "manual") return roots;
  return roots.slice().sort((first, second) => compareTasks(first, second, mode));
}

export function getComposeInsertIndex(
  roots: TaskNode[],
  draft: ComposeDraft,
  mode: TaskSortMode,
): number {
  if (mode === "manual" || mode === "created") return 0;

  const draftValue: SortableTaskValue = {
    createdAt: new Date().toISOString(),
    dueDate: draft.dueDate,
    scheduleType: draft.scheduleType,
    priority: draft.priority,
    order: Number.MIN_SAFE_INTEGER,
  };
  const index = roots.findIndex((task) => compareValues(draftValue, task, mode) < 0);
  return index === -1 ? roots.length : index;
}

export function compareTasks(
  first: TaskNode,
  second: TaskNode,
  mode: TaskSortMode,
): number {
  return compareValues(first, second, mode);
}

type SortableTaskValue = Pick<
  TaskNode,
  "createdAt" | "dueDate" | "scheduleType" | "priority" | "order"
>;

function compareValues(
  first: SortableTaskValue,
  second: SortableTaskValue,
  mode: TaskSortMode,
): number {
  if (mode === "created") {
    return second.createdAt.localeCompare(first.createdAt) || compareManual(first, second);
  }

  if (mode === "schedule") {
    return compareSchedule(first, second) || compareImportance(first, second) || compareManual(first, second);
  }

  if (mode === "importance") {
    return compareImportance(first, second) || compareSchedule(first, second) || compareManual(first, second);
  }

  return compareManual(first, second);
}

function compareSchedule(first: SortableTaskValue, second: SortableTaskValue): number {
  if (first.dueDate === null && second.dueDate === null) return 0;
  if (first.dueDate === null) return 1;
  if (second.dueDate === null) return -1;

  const dateCompare = first.dueDate.localeCompare(second.dueDate);
  if (dateCompare !== 0) return dateCompare;
  if (first.scheduleType !== second.scheduleType) {
    return first.scheduleType === "deadline" ? -1 : 1;
  }
  return 0;
}

function compareImportance(first: SortableTaskValue, second: SortableTaskValue): number {
  return PRIORITY_RANK[first.priority] - PRIORITY_RANK[second.priority];
}

function compareManual(first: SortableTaskValue, second: SortableTaskValue): number {
  return first.order - second.order || first.createdAt.localeCompare(second.createdAt);
}
