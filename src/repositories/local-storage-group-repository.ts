import { createDefaultGroups } from "@/lib/task-groups";
import type { TaskGroup, UserId } from "@/types/task";

const STORAGE_KEY_PREFIX = "todoapp.groups.v1";

export class LocalStorageGroupRepository {
  async listGroups(userId: UserId): Promise<TaskGroup[]> {
    const rawValue = window.localStorage.getItem(getStorageKey(userId));

    if (!rawValue) return createDefaultGroups(userId);

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      throw new Error("Stored groups are invalid.");
    }

    const groups = parsedValue.map((value) => assertGroup(value, userId));
    return groups.length > 0 ? groups : createDefaultGroups(userId);
  }

  async saveGroups(userId: UserId, groups: TaskGroup[]): Promise<void> {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(groups));
  }
}

function getStorageKey(userId: UserId): string {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

function assertGroup(value: unknown, userId: UserId): TaskGroup {
  if (!isRecord(value)) {
    throw new Error("Stored group is invalid.");
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.order !== "number" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Stored group is invalid.");
  }

  return {
    id: value.id,
    userId: typeof value.userId === "string" ? value.userId : userId,
    name: value.name,
    order: value.order,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
