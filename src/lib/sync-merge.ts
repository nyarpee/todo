import type { ActivityEvent } from "@/types/activity";
import type { Habit, HabitEntry } from "@/types/habit";
import type { Task, TaskGroup } from "@/types/task";

export type SyncMergeInput = {
  local: {
    groups: TaskGroup[];
    tasks: Task[];
    habits: Habit[];
    habitEntries: HabitEntry[];
    activityEvents: ActivityEvent[];
  };
  remote: {
    groups: TaskGroup[];
    tasks: Task[];
    habits: Habit[];
    habitEntries: HabitEntry[];
    activityEvents: ActivityEvent[];
  };
};

export type SyncMergeResult = SyncMergeInput["local"];

export function mergeSyncSnapshots({ local, remote }: SyncMergeInput): SyncMergeResult {
  const activityEvents = mergeActivityEvents(local.activityEvents, remote.activityEvents);
  const deletedAtByEntity = buildDeletedAtByEntity(activityEvents);
  const fieldVersions = {
    local: buildFieldVersions(local.activityEvents),
    remote: buildFieldVersions(remote.activityEvents),
  };

  const groups = mergeFieldRecords(
    local.groups,
    remote.groups,
    "task_group",
    GROUP_FIELDS,
    fieldVersions,
    (group) => isDeleted("task_group", group.id, group.updatedAt, deletedAtByEntity),
  );
  const habits = mergeFieldRecords(
    local.habits,
    remote.habits,
    "habit",
    HABIT_FIELDS,
    fieldVersions,
    (habit) => isDeleted("habit", habit.id, habit.updatedAt, deletedAtByEntity),
  );
  const habitEntries = mergeHabitEntries(local.habitEntries, remote.habitEntries, deletedAtByEntity);
  const tasks = repairTaskTree(
    mergeFieldRecords(
      local.tasks,
      remote.tasks,
      "task",
      TASK_FIELDS,
      fieldVersions,
      (task) => isDeleted("task", task.id, task.updatedAt, deletedAtByEntity),
    ),
    groups,
  );

  return {
    groups,
    tasks,
    habits,
    habitEntries,
    activityEvents,
  };
}

function mergeFieldRecords<RecordType extends { id: string; updatedAt: string; createdAt: string }>(
  localRecords: RecordType[],
  remoteRecords: RecordType[],
  entityType: ActivityEvent["entityType"],
  fields: readonly (keyof RecordType)[],
  fieldVersions: FieldVersionSets,
  shouldDrop: (record: RecordType) => boolean,
): RecordType[] {
  const localById = new Map(localRecords.map((record) => [record.id, record]));
  const remoteById = new Map(remoteRecords.map((record) => [record.id, record]));
  const recordsById = new Map<string, RecordType>();
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);

  for (const id of ids) {
    const localRecord = localById.get(id) ?? null;
    const remoteRecord = remoteById.get(id) ?? null;
    const fallbackRecord = chooseNewerRecord(localRecord, remoteRecord);
    if (!fallbackRecord || shouldDrop(fallbackRecord)) continue;

    if (!localRecord || !remoteRecord) {
      recordsById.set(id, fallbackRecord);
      continue;
    }

    const nextRecord = { ...fallbackRecord };
    for (const field of fields) {
      const sourceRecord = chooseFieldSource(
        localRecord,
        remoteRecord,
        entityType,
        field,
        fieldVersions,
      );
      nextRecord[field] = sourceRecord[field];
    }

    nextRecord.updatedAt = maxIso(localRecord.updatedAt, remoteRecord.updatedAt);
    recordsById.set(id, nextRecord);
  }

  return Array.from(recordsById.values()).sort((first, second) => {
    const firstOrder = "order" in first && typeof first.order === "number" ? first.order : 0;
    const secondOrder = "order" in second && typeof second.order === "number" ? second.order : 0;
    if (firstOrder !== secondOrder) return firstOrder - secondOrder;
    return first.createdAt.localeCompare(second.createdAt);
  });
}

function chooseNewerRecord<RecordType extends { updatedAt: string }>(
  localRecord: RecordType | null,
  remoteRecord: RecordType | null,
): RecordType | null {
  if (!localRecord) return remoteRecord;
  if (!remoteRecord) return localRecord;
  return compareIso(localRecord.updatedAt, remoteRecord.updatedAt) >= 0 ? localRecord : remoteRecord;
}

function chooseFieldSource<RecordType extends { id: string; updatedAt: string }>(
  localRecord: RecordType,
  remoteRecord: RecordType,
  entityType: ActivityEvent["entityType"],
  field: keyof RecordType,
  fieldVersions: FieldVersionSets,
): RecordType {
  const localVersion = getFieldVersion(fieldVersions.local, entityType, localRecord.id, String(field));
  const remoteVersion = getFieldVersion(fieldVersions.remote, entityType, remoteRecord.id, String(field));

  if (localVersion && remoteVersion) {
    if (localVersion.updatedAt !== remoteVersion.updatedAt) {
      return compareIso(localVersion.updatedAt, remoteVersion.updatedAt) > 0
        ? localRecord
        : remoteRecord;
    }

    return localVersion.clientId >= remoteVersion.clientId ? localRecord : remoteRecord;
  }

  if (localVersion) return localRecord;
  if (remoteVersion) return remoteRecord;

  return compareIso(localRecord.updatedAt, remoteRecord.updatedAt) >= 0 ? localRecord : remoteRecord;
}

function mergeHabitEntries(
  localEntries: HabitEntry[],
  remoteEntries: HabitEntry[],
  deletedAtByEntity: Map<string, string>,
): HabitEntry[] {
  const entriesById = new Map<string, HabitEntry>();

  for (const entry of [...remoteEntries, ...localEntries]) {
    if (isDeleted("habit_entry", entry.id, entry.createdAt, deletedAtByEntity)) continue;
    entriesById.set(entry.id, entry);
  }

  return Array.from(entriesById.values()).sort((first, second) =>
    first.createdAt.localeCompare(second.createdAt),
  );
}

function mergeActivityEvents(
  localEvents: ActivityEvent[],
  remoteEvents: ActivityEvent[],
): ActivityEvent[] {
  const eventsById = new Map<string, ActivityEvent>();

  for (const event of [...remoteEvents, ...localEvents]) {
    eventsById.set(event.id, event);
  }

  return Array.from(eventsById.values()).sort((first, second) =>
    first.createdAt.localeCompare(second.createdAt),
  );
}

function buildDeletedAtByEntity(events: ActivityEvent[]): Map<string, string> {
  const deletedAtByEntity = new Map<string, string>();

  for (const event of events) {
    if (!isDeleteEvent(event)) continue;

    const key = getEntityKey(event.entityType, event.entityId);
    const existingDeletedAt = deletedAtByEntity.get(key);
    if (!existingDeletedAt || compareIso(event.createdAt, existingDeletedAt) > 0) {
      deletedAtByEntity.set(key, event.createdAt);
    }
  }

  return deletedAtByEntity;
}

function buildFieldVersions(events: ActivityEvent[]): FieldVersions {
  const versions: FieldVersions = new Map();

  for (const event of events) {
    const fields = getEventFields(event);
    if (fields.length === 0) continue;

    for (const field of fields) {
      const key = getFieldKey(event.entityType, event.entityId, field);
      const existing = versions.get(key);
      if (!existing || compareIso(event.createdAt, existing.updatedAt) >= 0) {
        versions.set(key, {
          updatedAt: event.createdAt,
          clientId: event.clientId,
        });
      }
    }
  }

  return versions;
}

function getEventFields(event: ActivityEvent): string[] {
  const explicitFields = event.payload.fields;
  if (Array.isArray(explicitFields)) {
    return explicitFields.filter((field): field is string => typeof field === "string");
  }

  if (typeof event.payload.field === "string") {
    return [event.payload.field];
  }

  if (event.type === "task_completed" || event.type === "task_uncompleted") {
    return ["completed", "completedAt"];
  }

  if (event.type === "task_priority_changed") {
    return ["priority"];
  }

  if (event.type === "task_scheduled") {
    return ["dueDate", "dueTime"];
  }

  if (event.type === "task_moved") {
    return ["groupId", "parentId", "order"];
  }

  if (event.type === "group_updated") {
    return ["name"];
  }

  if (event.type === "habit_updated") {
    return ["title", "unitType", "unitMinutes", "color"];
  }

  if (event.type === "habit_reordered") {
    return ["order"];
  }

  return [];
}

function isDeleted(
  entityType: ActivityEvent["entityType"],
  entityId: string,
  recordUpdatedAt: string,
  deletedAtByEntity: Map<string, string>,
): boolean {
  const deletedAt = deletedAtByEntity.get(getEntityKey(entityType, entityId));
  return Boolean(deletedAt && compareIso(deletedAt, recordUpdatedAt) >= 0);
}

function isDeleteEvent(event: ActivityEvent): boolean {
  return (
    event.type === "task_deleted" ||
    event.type === "group_deleted" ||
    event.type === "habit_deleted" ||
    event.type === "habit_unchecked"
  );
}

function repairTaskTree(tasks: Task[], groups: TaskGroup[]): Task[] {
  const taskIds = new Set(tasks.map((task) => task.id));
  const groupIds = new Set(groups.map((group) => group.id));
  const fallbackGroupId = groups[0]?.id ?? null;

  return tasks.map((task) => {
    const parentId = task.parentId && taskIds.has(task.parentId) ? task.parentId : null;
    const groupId = groupIds.has(task.groupId) ? task.groupId : fallbackGroupId ?? task.groupId;

    return {
      ...task,
      parentId,
      groupId,
    };
  });
}

function getEntityKey(entityType: ActivityEvent["entityType"], entityId: string): string {
  return `${entityType}:${entityId}`;
}

function getFieldVersion(
  fieldVersions: FieldVersions,
  entityType: ActivityEvent["entityType"],
  entityId: string,
  field: string,
): FieldVersion | null {
  return fieldVersions.get(getFieldKey(entityType, entityId, field)) ?? null;
}

function getFieldKey(
  entityType: ActivityEvent["entityType"],
  entityId: string,
  field: string,
): string {
  return `${entityType}:${entityId}:${field}`;
}

function compareIso(first: string, second: string): number {
  return first.localeCompare(second);
}

function maxIso(first: string, second: string): string {
  return compareIso(first, second) >= 0 ? first : second;
}

type FieldVersion = {
  updatedAt: string;
  clientId: string;
};

type FieldVersions = Map<string, FieldVersion>;

type FieldVersionSets = {
  local: FieldVersions;
  remote: FieldVersions;
};

const TASK_FIELDS = [
  "title",
  "description",
  "groupId",
  "parentId",
  "order",
  "completed",
  "completedAt",
  "priority",
  "dueDate",
  "dueTime",
] as const satisfies readonly (keyof Task)[];

const GROUP_FIELDS = [
  "name",
  "order",
] as const satisfies readonly (keyof TaskGroup)[];

const HABIT_FIELDS = [
  "title",
  "unitType",
  "unitMinutes",
  "color",
  "order",
] as const satisfies readonly (keyof Habit)[];
