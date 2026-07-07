import type { HabitEntryId, HabitId } from "./habit";
import type { TaskGroupId, TaskId, UserId } from "./task";

export type ActivityEntityType = "task" | "task_group" | "habit" | "habit_entry";

export type ActivityEntityId = TaskId | TaskGroupId | HabitId | HabitEntryId;

export type ActivityEventType =
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "task_uncompleted"
  | "task_deleted"
  | "task_moved"
  | "task_scheduled"
  | "task_priority_changed"
  | "group_created"
  | "group_updated"
  | "group_deleted"
  | "habit_created"
  | "habit_updated"
  | "habit_deleted"
  | "habit_checked"
  | "habit_unchecked"
  | "habit_reordered";

export type ActivityEvent = {
  id: string;
  userId: UserId;
  type: ActivityEventType;
  entityType: ActivityEntityType;
  entityId: ActivityEntityId;
  clientId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
