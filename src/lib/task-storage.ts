import type { Task } from "../types/task";
import { DEFAULT_MY_TASKS_GROUP_ID } from "./task-groups";

const STORAGE_KEY = "todoapp.tasks.v1";

export function loadTasks(storage: Storage = localStorage): Task[] {
  const rawValue = storage.getItem(STORAGE_KEY);

  if (!rawValue) return [];

  const parsedValue: unknown = JSON.parse(rawValue);

  if (!Array.isArray(parsedValue)) {
    throw new Error("Stored tasks are invalid.");
  }

  return parsedValue.map(assertTask);
}

export function saveTasks(tasks: Task[], storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function assertTask(value: unknown): Task {
  if (!isRecord(value)) {
    throw new Error("Stored task is invalid.");
  }

  const task = value;

  if (
    typeof task.id !== "string" ||
    typeof task.userId !== "string" ||
    typeof task.title !== "string" ||
    !(typeof task.parentId === "string" || task.parentId === null) ||
    typeof task.order !== "number" ||
    typeof task.completed !== "boolean" ||
    typeof task.createdAt !== "string" ||
    typeof task.updatedAt !== "string"
  ) {
    throw new Error("Stored task is invalid.");
  }

  return {
    id: task.id,
    userId: task.userId,
    title: task.title,
    description: typeof task.description === "string" ? task.description : "",
    groupId: typeof task.groupId === "string" ? task.groupId : DEFAULT_MY_TASKS_GROUP_ID,
    parentId: task.parentId,
    order: task.order,
    completed: task.completed,
    completedAt: typeof task.completedAt === "string" ? task.completedAt : null,
    priority: isTaskPriority(task.priority) ? task.priority : "none",
    dueDate: typeof task.dueDate === "string" ? task.dueDate : null,
    dueTime: typeof task.dueTime === "string" ? task.dueTime : null,
    scheduleType: isTaskScheduleType(task.scheduleType) ? task.scheduleType : "deadline",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function isTaskScheduleType(value: unknown): value is Task["scheduleType"] {
  return value === "scheduled" || value === "deadline";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTaskPriority(value: unknown): value is Task["priority"] {
  return value === "high" || value === "medium" || value === "low" || value === "none";
}
