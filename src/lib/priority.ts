import type { TaskNode, TaskPriority } from "@/types/task";

export type PriorityLabels = Record<TaskPriority, string>;

export type PriorityOption = {
  id: TaskPriority;
  label: string;
  rank: number;
};

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { id: "high", label: "High", rank: 3 },
  { id: "medium", label: "Medium", rank: 2 },
  { id: "low", label: "Low", rank: 1 },
  { id: "none", label: "None", rank: 0 },
];

export const DEFAULT_PRIORITY_LABELS: PriorityLabels = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

export function getPriorityLabel(
  priority: TaskPriority,
  labels: PriorityLabels = DEFAULT_PRIORITY_LABELS,
): string {
  return labels[priority] ?? DEFAULT_PRIORITY_LABELS[priority];
}

export function getPriorityClass(priority: TaskPriority): string {
  return `priority-${priority}`;
}

export function getHighestPriority(tasks: TaskNode[]): TaskPriority {
  let highest: PriorityOption = NONE_PRIORITY;

  for (const task of tasks) {
    const option =
      PRIORITY_OPTIONS.find((priorityOption) => priorityOption.id === task.priority) ??
      NONE_PRIORITY;

    if (option.rank > highest.rank) {
      highest = option;
    }
  }

  return highest.id;
}

const NONE_PRIORITY: PriorityOption = { id: "none", label: "None", rank: 0 };
