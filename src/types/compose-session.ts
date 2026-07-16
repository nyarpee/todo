import type { TaskGroupId, TaskId, TaskPriority } from "./task";

export type ComposeTarget = {
  groupId: TaskGroupId;
  parentTaskId: TaskId | null;
};

export type ComposeDraft = {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: TaskPriority;
};

export type ComposePanel = "compact" | "location" | "schedule" | "priority";

// The sole source of truth for one in-progress task. Views only decide where
// its ghost slot is rendered; they never own a separate draft or destination.
// (The calendar tab still runs its own day-scoped composer for now.)
export type ComposeSession = {
  draft: ComposeDraft;
  target: ComposeTarget;
  panel: ComposePanel;
};
