import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityEvent } from "@/types/activity";
import type { Habit, HabitEntry } from "@/types/habit";
import type { SyncQueueItem } from "@/types/sync";
import type { Task, TaskGroup, UserId } from "@/types/task";

export type LocalSyncSnapshot = {
  groups: TaskGroup[];
  tasks: Task[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  activityEvents: ActivityEvent[];
  pendingSyncItems: SyncQueueItem[];
};

export type PulledSyncSnapshot = {
  groups: TaskGroup[];
  tasks: Task[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  activityEvents: ActivityEvent[];
};

export async function pushLocalSnapshotToSupabase(
  client: SupabaseClient,
  authUserId: string,
  snapshot: LocalSyncSnapshot,
): Promise<string[]> {
  await upsertRows(client, "task_groups", snapshot.groups.map((group) => groupToRow(group, authUserId)));
  await upsertRows(
    client,
    "tasks",
    sortTasksForUpsert(snapshot.tasks).map((task) => taskToRow(task, authUserId)),
  );
  await upsertRows(client, "habits", snapshot.habits.map((habit) => habitToRow(habit, authUserId)));
  await upsertRows(
    client,
    "habit_entries",
    snapshot.habitEntries.map((entry) => habitEntryToRow(entry, authUserId)),
  );
  await upsertRows(
    client,
    "activity_events",
    snapshot.activityEvents.map((event) => activityEventToRow(event, authUserId)),
  );

  await applyPendingDeletes(client, authUserId, snapshot.pendingSyncItems);

  return snapshot.pendingSyncItems.map((item) => item.id);
}

export async function pullSupabaseSnapshot(
  client: SupabaseClient,
  authUserId: string,
  localUserId: UserId,
): Promise<PulledSyncSnapshot> {
  const [groups, tasks, habits, habitEntries, activityEvents] = await Promise.all([
    selectRows<TaskGroupRow>(client, "task_groups", authUserId, "sort_order"),
    selectRows<TaskRow>(client, "tasks", authUserId, "sort_order"),
    selectRows<HabitRow>(client, "habits", authUserId, "sort_order"),
    selectRows<HabitEntryRow>(client, "habit_entries", authUserId, "created_at"),
    selectActivityEventRows(client, authUserId),
  ]);

  return {
    groups: groups.map((row) => rowToGroup(row, localUserId)),
    tasks: tasks.map((row) => rowToTask(row, localUserId)),
    habits: habits.map((row) => rowToHabit(row, localUserId)),
    habitEntries: habitEntries.map((row) => rowToHabitEntry(row, localUserId)),
    activityEvents: activityEvents.map((row) => rowToActivityEvent(row, localUserId)),
  };
}

async function upsertRows(
  client: SupabaseClient,
  tableName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await client.from(tableName).upsert(rows, {
    onConflict: "user_id,id",
  });

  if (error) throw new Error(`${tableName} upsert failed: ${formatSupabaseError(error)}`);
}

async function selectRows<Row>(
  client: SupabaseClient,
  tableName: string,
  authUserId: string,
  orderColumn: string,
): Promise<Row[]> {
  const { data, error } = await client
    .from(tableName)
    .select("*")
    .eq("user_id", authUserId)
    .is("deleted_at", null)
    .order(orderColumn, { ascending: true });

  if (error) throw new Error(`${tableName} select failed: ${formatSupabaseError(error)}`);
  return (data ?? []) as Row[];
}

async function selectActivityEventRows(
  client: SupabaseClient,
  authUserId: string,
): Promise<ActivityEventRow[]> {
  const { data, error } = await client
    .from("activity_events")
    .select("*")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`activity_events select failed: ${formatSupabaseError(error)}`);
  return (data ?? []) as ActivityEventRow[];
}

async function applyPendingDeletes(
  client: SupabaseClient,
  authUserId: string,
  pendingItems: SyncQueueItem[],
): Promise<void> {
  const deleteItems = pendingItems.filter((item) =>
    item.operation === "task_deleted" ||
    item.operation === "group_deleted" ||
    item.operation === "habit_deleted" ||
    item.operation === "habit_unchecked"
  );

  for (const item of deleteItems) {
    const tableName = getDeleteTableName(item);
    if (!tableName) continue;

    const { error } = await client
      .from(tableName)
      .delete()
      .eq("user_id", authUserId)
      .eq("id", item.entityId);

    if (error) {
      throw new Error(`${tableName} delete failed: ${formatSupabaseError(error)}`);
    }
  }
}

function getDeleteTableName(item: SyncQueueItem): string | null {
  if (item.operation === "task_deleted") return "tasks";
  if (item.operation === "group_deleted") return "task_groups";
  if (item.operation === "habit_deleted") return "habits";
  if (item.operation === "habit_unchecked") return "habit_entries";
  return null;
}

function sortTasksForUpsert(tasks: Task[]): Task[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  return tasks
    .slice()
    .sort((first, second) => getTaskDepth(first, taskById) - getTaskDepth(second, taskById));
}

function getTaskDepth(task: Task, taskById: Map<string, Task>): number {
  let depth = 0;
  let current = task;

  while (current.parentId) {
    const parent = taskById.get(current.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }

  return depth;
}

function groupToRow(group: TaskGroup, authUserId: string): TaskGroupRow {
  return {
    id: group.id,
    user_id: authUserId,
    name: group.name,
    sort_order: group.order,
    client_id: null,
    created_at: group.createdAt,
    updated_at: group.updatedAt,
    deleted_at: null,
  };
}

function taskToRow(task: Task, authUserId: string): TaskRow {
  return {
    id: task.id,
    user_id: authUserId,
    group_id: task.groupId,
    parent_id: task.parentId,
    title: task.title,
    description: task.description,
    sort_order: task.order,
    completed: task.completed,
    completed_at: task.completedAt,
    priority: task.priority,
    due_date: task.dueDate,
    due_time: task.dueTime,
    schedule_type: task.scheduleType,
    client_id: null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    deleted_at: null,
  };
}

function habitToRow(habit: Habit, authUserId: string): HabitRow {
  return {
    id: habit.id,
    user_id: authUserId,
    title: habit.title,
    unit_type: habit.unitType,
    unit_minutes: habit.unitMinutes,
    color: habit.color,
    sort_order: habit.order,
    client_id: null,
    created_at: habit.createdAt,
    updated_at: habit.updatedAt,
    deleted_at: null,
  };
}

function habitEntryToRow(entry: HabitEntry, authUserId: string): HabitEntryRow {
  return {
    id: entry.id,
    user_id: authUserId,
    habit_id: entry.habitId,
    minutes: entry.minutes,
    checked_at: entry.checkedAt,
    client_id: null,
    created_at: entry.createdAt,
    updated_at: entry.createdAt,
    deleted_at: null,
  };
}

function activityEventToRow(event: ActivityEvent, authUserId: string): ActivityEventRow {
  return {
    id: event.id,
    user_id: authUserId,
    type: event.type,
    entity_type: event.entityType,
    entity_id: event.entityId,
    client_id: event.clientId,
    payload: event.payload,
    created_at: event.createdAt,
  };
}

function rowToGroup(row: TaskGroupRow, localUserId: UserId): TaskGroup {
  return {
    id: row.id,
    userId: localUserId,
    name: row.name,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTask(row: TaskRow, localUserId: UserId): Task {
  return {
    id: row.id,
    userId: localUserId,
    title: row.title,
    description: row.description,
    groupId: row.group_id,
    parentId: row.parent_id,
    order: row.sort_order,
    completed: row.completed,
    completedAt: row.completed_at,
    priority: row.priority,
    dueDate: row.due_date,
    dueTime: row.due_time,
    scheduleType: row.schedule_type ?? "deadline",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHabit(row: HabitRow, localUserId: UserId): Habit {
  return {
    id: row.id,
    userId: localUserId,
    title: row.title,
    unitType: row.unit_type,
    unitMinutes: row.unit_minutes,
    color: row.color,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHabitEntry(row: HabitEntryRow, localUserId: UserId): HabitEntry {
  return {
    id: row.id,
    habitId: row.habit_id,
    userId: localUserId,
    minutes: row.minutes,
    checkedAt: row.checked_at,
    createdAt: row.created_at,
  };
}

function rowToActivityEvent(row: ActivityEventRow, localUserId: UserId): ActivityEvent {
  return {
    id: row.id,
    userId: localUserId,
    type: row.type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    clientId: row.client_id,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

type BaseRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type TaskGroupRow = BaseRow & {
  name: string;
  sort_order: number;
};

type TaskRow = BaseRow & {
  group_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  sort_order: number;
  completed: boolean;
  completed_at: string | null;
  priority: Task["priority"];
  due_date: string | null;
  due_time: string | null;
  schedule_type: Task["scheduleType"] | null;
};

type HabitRow = BaseRow & {
  title: string;
  unit_type: Habit["unitType"];
  unit_minutes: number;
  color: Habit["color"];
  sort_order: number;
};

type HabitEntryRow = BaseRow & {
  habit_id: string;
  minutes: number;
  checked_at: string;
};

type ActivityEventRow = {
  id: string;
  user_id: string;
  type: ActivityEvent["type"];
  entity_type: ActivityEvent["entityType"];
  entity_id: string;
  client_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

function formatSupabaseError(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}): string {
  return [
    error.message,
    error.code ? `code: ${error.code}` : null,
    error.details,
    error.hint,
  ]
    .filter(Boolean)
    .join(" / ");
}
