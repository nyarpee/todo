import type { Task, UserId } from "@/types/task";

export type TaskRepository = {
  listTasks(userId: UserId): Promise<Task[]>;
  saveTasks(userId: UserId, tasks: Task[]): Promise<void>;
};

export const ANONYMOUS_USER_ID = "anonymous";
export const LEGACY_LOCAL_USER_ID = "local-user";
