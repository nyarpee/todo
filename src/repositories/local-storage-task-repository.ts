import type { Task, UserId } from "@/types/task";
import { DEFAULT_MY_TASKS_GROUP_ID } from "@/lib/task-groups";
import type { TaskRepository } from "./task-repository";

const STORAGE_KEY_PREFIX = "todoapp.tasks.v1";

export class LocalStorageTaskRepository implements TaskRepository {
  async listTasks(userId: UserId): Promise<Task[]> {
    const rawValue = window.localStorage.getItem(getStorageKey(userId));

    if (!rawValue) return [];

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      throw new Error("Stored tasks are invalid.");
    }

    return parsedValue.map(assertTask);
  }

  async saveTasks(userId: UserId, tasks: Task[]): Promise<void> {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(tasks));
  }
}

function getStorageKey(userId: UserId): string {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

function assertTask(value: unknown): Task {
  if (!isRecord(value)) {
    throw new Error("Stored task is invalid.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.title !== "string" ||
    !(typeof value.parentId === "string" || value.parentId === null) ||
    typeof value.order !== "number" ||
    typeof value.completed !== "boolean" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Stored task is invalid.");
  }

  return {
    id: value.id,
    userId: value.userId,
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    groupId: typeof value.groupId === "string" ? value.groupId : DEFAULT_MY_TASKS_GROUP_ID,
    parentId: value.parentId,
    order: value.order,
    completed: value.completed,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
    priority: isTaskPriority(value.priority) ? value.priority : "none",
    dueDate: typeof value.dueDate === "string" ? value.dueDate : null,
    dueTime: typeof value.dueTime === "string" ? value.dueTime : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTaskPriority(value: unknown): value is Task["priority"] {
  return value === "high" || value === "medium" || value === "low" || value === "none";
}
