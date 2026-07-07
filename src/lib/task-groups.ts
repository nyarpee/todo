import type { TaskGroup, UserId } from "@/types/task";

export const DEFAULT_MY_TASKS_GROUP_ID = "group-my-tasks";
export const DEFAULT_PROJECTS_GROUP_ID = "group-projects";

export function createDefaultGroups(userId: UserId, now = new Date().toISOString()): TaskGroup[] {
  return [
    createGroup(DEFAULT_MY_TASKS_GROUP_ID, userId, "My tasks", 0, now),
    createGroup(DEFAULT_PROJECTS_GROUP_ID, userId, "Projects", 1, now),
  ];
}

export function createGroup(
  id: string,
  userId: UserId,
  name: string,
  order: number,
  now = new Date().toISOString(),
): TaskGroup {
  return {
    id,
    userId,
    name,
    order,
    createdAt: now,
    updatedAt: now,
  };
}
