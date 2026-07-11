import { arrayMove } from "@dnd-kit/sortable";
import type { ActivityEntityType, ActivityEvent, ActivityEventType } from "@/types/activity";
import type { Habit, HabitColor, HabitEntry, HabitUnitType } from "@/types/habit";
import type { Task, TaskGroup, TaskGroupId, TaskId, UserId } from "@/types/task";
import { reorderHabits } from "./habit-actions";
import { deleteTask, syncAncestorCompletion } from "./task-actions";

export function applyTaskActivityEvent(tasks: Task[], event: ActivityEvent): Task[] {
  if (event.entityType !== "task") return tasks;

  if (event.type === "task_created") {
    const task = readTaskPayload(event.payload.task);
    if (!task) return tasks;

    const existingTask = tasks.find((currentTask) => currentTask.id === task.id);
    if (!existingTask) {
      return syncAncestorCompletion([...tasks, task], task.id, { now: () => event.createdAt });
    }

    if (compareIso(existingTask.updatedAt, task.updatedAt) > 0) {
      return tasks;
    }

    return syncAncestorCompletion(
      tasks.map((currentTask) => (currentTask.id === task.id ? task : currentTask)),
      task.id,
      { now: () => event.createdAt },
    );
  }

  if (event.type === "task_deleted") {
    if (!tasks.some((task) => task.id === event.entityId)) return tasks;
    return deleteTask(tasks, event.entityId);
  }

  if (event.type === "task_moved") {
    const movedTasks = readTaskArrayPayload(event.payload.tasks);
    if (movedTasks.length > 0) {
      return mergeTaskPayloads(tasks, movedTasks);
    }
  }

  const patch = readTaskPatchPayload(event.payload.patch, event);
  if (!patch) return tasks;

  const nextTasks = tasks.map((task) => {
    if (task.id !== event.entityId) return task;
    if (compareIso(task.updatedAt, patch.updatedAt ?? event.createdAt) > 0) return task;

    return {
      ...task,
      ...patch,
      updatedAt: patch.updatedAt ?? event.createdAt,
    };
  });

  if ("completed" in patch) {
    return syncAncestorCompletion(nextTasks, event.entityId, { now: () => patch.updatedAt ?? event.createdAt });
  }

  return nextTasks;
}

export function applyGroupActivityEvent(groups: TaskGroup[], event: ActivityEvent): TaskGroup[] {
  if (event.entityType !== "task_group") return groups;

  if (event.type === "group_created") {
    const group = readGroupPayload(event.payload.group);
    if (!group) return groups;

    const existingGroup = groups.find((currentGroup) => currentGroup.id === group.id);
    if (!existingGroup) return [...groups, group].sort(sortGroupsByOrder);
    if (compareIso(existingGroup.updatedAt, group.updatedAt) > 0) return groups;

    return groups
      .map((currentGroup) => (currentGroup.id === group.id ? group : currentGroup))
      .sort(sortGroupsByOrder);
  }

  if (event.type === "group_deleted") {
    return groups
      .filter((group) => group.id !== event.entityId)
      .map((group, index) => ({ ...group, order: index }));
  }

  const patch = readGroupPatchPayload(event.payload.patch);
  if (!patch) return groups;

  return groups
    .map((group) => {
      if (group.id !== event.entityId) return group;
      if (compareIso(group.updatedAt, patch.updatedAt ?? event.createdAt) > 0) return group;

      return {
        ...group,
        ...patch,
        updatedAt: patch.updatedAt ?? event.createdAt,
      };
    })
    .sort(sortGroupsByOrder);
}

export function applyHabitActivityEvent(habits: Habit[], event: ActivityEvent): Habit[] {
  if (event.entityType !== "habit") return habits;

  if (event.type === "habit_created") {
    const habit = readHabitPayload(event.payload.habit);
    if (!habit) return habits;

    const existingHabit = habits.find((currentHabit) => currentHabit.id === habit.id);
    if (!existingHabit) return [...habits, habit].sort(sortHabitsByOrder);
    if (compareIso(existingHabit.updatedAt, habit.updatedAt) > 0) return habits;

    return habits
      .map((currentHabit) => (currentHabit.id === habit.id ? habit : currentHabit))
      .sort(sortHabitsByOrder);
  }

  if (event.type === "habit_deleted") {
    return habits.filter((habit) => habit.id !== event.entityId);
  }

  if (event.type === "habit_reordered") {
    const orderedHabitIds = readStringArrayPayload(event.payload.orderedHabitIds);
    if (orderedHabitIds.length === 0) return habits;
    return reorderHabits(habits, orderedHabitIds, { now: () => event.createdAt });
  }

  const patch = readHabitPatchPayload(event.payload.patch);
  if (!patch) return habits;

  return habits
    .map((habit) => {
      if (habit.id !== event.entityId) return habit;
      if (compareIso(habit.updatedAt, patch.updatedAt ?? event.createdAt) > 0) return habit;

      return {
        ...habit,
        ...patch,
        updatedAt: patch.updatedAt ?? event.createdAt,
      };
    })
    .sort(sortHabitsByOrder);
}

export function applyHabitEntryActivityEvent(entries: HabitEntry[], event: ActivityEvent): HabitEntry[] {
  if (event.entityType !== "habit_entry") return entries;

  if (event.type === "habit_checked") {
    const entry = readHabitEntryPayload(event.payload.entry);
    if (!entry || entries.some((currentEntry) => currentEntry.id === entry.id)) return entries;
    return [...entries, entry].sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }

  if (event.type === "habit_unchecked") {
    return entries.filter((entry) => entry.id !== event.entityId);
  }

  return entries;
}

export function buildRootTaskBefore(
  tasks: Task[],
  taskId: TaskId,
  overTaskId: TaskId,
  destinationGroupId: TaskGroupId,
): Task[] {
  const draggedTask = tasks.find((task) => task.id === taskId);
  if (!draggedTask) return tasks;

  const destinationRoots = tasks
    .filter(
      (task) =>
        task.parentId === null &&
        task.groupId === destinationGroupId &&
        !task.completed,
    )
    .sort(sortTasksByOrder);
  const oldIndex = destinationRoots.findIndex((task) => task.id === taskId);
  const overIndex = destinationRoots.findIndex((task) => task.id === overTaskId);

  if (overIndex < 0) return tasks;

  const orderedRoots =
    oldIndex >= 0
      ? arrayMove(destinationRoots, oldIndex, overIndex)
      : insertTaskAt(destinationRoots, { ...draggedTask, groupId: destinationGroupId }, overIndex);

  return applyRootOrderAndGroup(tasks, taskId, destinationGroupId, orderedRoots);
}

export function buildChildTaskBefore(
  tasks: Task[],
  taskId: TaskId,
  overTaskId: TaskId,
): Task[] {
  const draggedTask = tasks.find((task) => task.id === taskId);
  const overTask = tasks.find((task) => task.id === overTaskId);
  if (!draggedTask || !overTask) return tasks;
  // Only reorder within the same parent (subtask sibling list).
  if (draggedTask.parentId !== overTask.parentId) return tasks;

  const siblings = tasks
    .filter((task) => task.parentId === draggedTask.parentId)
    .sort(sortTasksByOrder);
  const oldIndex = siblings.findIndex((task) => task.id === taskId);
  const overIndex = siblings.findIndex((task) => task.id === overTaskId);
  if (oldIndex < 0 || overIndex < 0) return tasks;

  const orderedSiblings = arrayMove(siblings, oldIndex, overIndex);
  const now = new Date().toISOString();
  const orderById = new Map(orderedSiblings.map((task, index) => [task.id, index]));

  return tasks.map((task) => {
    const nextOrder = orderById.get(task.id);
    if (nextOrder === undefined || nextOrder === task.order) return task;
    return { ...task, order: nextOrder, updatedAt: now };
  });
}

export function buildRootTaskToGroupEnd(
  tasks: Task[],
  taskId: TaskId,
  destinationGroupId: TaskGroupId,
): Task[] {
  const draggedTask = tasks.find((task) => task.id === taskId);
  if (!draggedTask) return tasks;

  const destinationRoots = tasks
    .filter(
      (task) =>
        task.parentId === null &&
        task.groupId === destinationGroupId &&
        !task.completed &&
        task.id !== taskId,
    )
    .sort(sortTasksByOrder);
  const orderedRoots = [...destinationRoots, { ...draggedTask, groupId: destinationGroupId }];

  return applyRootOrderAndGroup(tasks, taskId, destinationGroupId, orderedRoots);
}

export function getChangedTasks(previousTasks: Task[], nextTasks: Task[]): Task[] {
  const previousById = new Map(previousTasks.map((task) => [task.id, task]));

  return nextTasks.filter((task) => {
    const previousTask = previousById.get(task.id);
    if (!previousTask) return true;

    return (
      previousTask.groupId !== task.groupId ||
      previousTask.parentId !== task.parentId ||
      previousTask.order !== task.order ||
      previousTask.updatedAt !== task.updatedAt
    );
  });
}

export function getRealtimeActivityEvent(payload: unknown, userId: UserId): ActivityEvent | null {
  if (!payload || typeof payload !== "object") return null;

  const maybePayload = payload as { new?: unknown };
  if (!maybePayload.new || typeof maybePayload.new !== "object") return null;

  const record = maybePayload.new as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.type !== "string" ||
    typeof record.entity_type !== "string" ||
    typeof record.entity_id !== "string" ||
    typeof record.client_id !== "string" ||
    typeof record.created_at !== "string" ||
    !isActivityEventType(record.type) ||
    !isActivityEntityType(record.entity_type)
  ) {
    return null;
  }

  const payloadValue = record.payload;

  return {
    id: record.id,
    userId,
    type: record.type,
    entityType: record.entity_type,
    entityId: record.entity_id,
    clientId: record.client_id,
    payload: payloadValue && typeof payloadValue === "object"
      ? payloadValue as Record<string, unknown>
      : {},
    createdAt: record.created_at,
  };
}

function readTaskPayload(value: unknown): Task | null {
  if (!value || typeof value !== "object") return null;

  const task = value as Partial<Task>;
  if (
    typeof task.id !== "string" ||
    typeof task.userId !== "string" ||
    typeof task.title !== "string" ||
    typeof task.description !== "string" ||
    typeof task.groupId !== "string" ||
    typeof task.order !== "number" ||
    typeof task.completed !== "boolean" ||
    typeof task.createdAt !== "string" ||
    typeof task.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: task.id,
    userId: task.userId,
    title: task.title,
    description: task.description,
    groupId: task.groupId,
    parentId: typeof task.parentId === "string" ? task.parentId : null,
    order: task.order,
    completed: task.completed,
    completedAt: typeof task.completedAt === "string" ? task.completedAt : null,
    priority: isTaskPriority(task.priority) ? task.priority : "none",
    dueDate: typeof task.dueDate === "string" ? task.dueDate : null,
    dueTime: typeof task.dueTime === "string" ? task.dueTime : null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function readTaskArrayPayload(value: unknown): Task[] {
  return Array.isArray(value)
    ? value.map(readTaskPayload).filter((task): task is Task => task !== null)
    : [];
}

function mergeTaskPayloads(tasks: Task[], payloadTasks: Task[]): Task[] {
  const nextTasksById = new Map(tasks.map((task) => [task.id, task]));

  payloadTasks.forEach((payloadTask) => {
    const currentTask = nextTasksById.get(payloadTask.id);
    if (currentTask && compareIso(currentTask.updatedAt, payloadTask.updatedAt) > 0) return;
    nextTasksById.set(payloadTask.id, payloadTask);
  });

  return Array.from(nextTasksById.values());
}

function readGroupPayload(value: unknown): TaskGroup | null {
  if (!value || typeof value !== "object") return null;

  const group = value as Partial<TaskGroup>;
  if (
    typeof group.id !== "string" ||
    typeof group.userId !== "string" ||
    typeof group.name !== "string" ||
    typeof group.order !== "number" ||
    typeof group.createdAt !== "string" ||
    typeof group.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: group.id,
    userId: group.userId,
    name: group.name,
    order: group.order,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

function readHabitPayload(value: unknown): Habit | null {
  if (!value || typeof value !== "object") return null;

  const habit = value as Partial<Habit>;
  if (
    typeof habit.id !== "string" ||
    typeof habit.userId !== "string" ||
    typeof habit.title !== "string" ||
    typeof habit.unitMinutes !== "number" ||
    typeof habit.order !== "number" ||
    typeof habit.createdAt !== "string" ||
    typeof habit.updatedAt !== "string" ||
    !isHabitUnitType(habit.unitType) ||
    !isHabitColor(habit.color)
  ) {
    return null;
  }

  return {
    id: habit.id,
    userId: habit.userId,
    title: habit.title,
    unitType: habit.unitType,
    unitMinutes: habit.unitMinutes,
    color: habit.color,
    order: habit.order,
    createdAt: habit.createdAt,
    updatedAt: habit.updatedAt,
  };
}

function readHabitEntryPayload(value: unknown): HabitEntry | null {
  if (!value || typeof value !== "object") return null;

  const entry = value as Partial<HabitEntry>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.habitId !== "string" ||
    typeof entry.userId !== "string" ||
    typeof entry.minutes !== "number" ||
    typeof entry.checkedAt !== "string" ||
    typeof entry.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: entry.id,
    habitId: entry.habitId,
    userId: entry.userId,
    minutes: entry.minutes,
    checkedAt: entry.checkedAt,
    createdAt: entry.createdAt,
  };
}

function readTaskPatchPayload(value: unknown, event: ActivityEvent): (Partial<Task> & { updatedAt?: string }) | null {
  if (value && typeof value === "object") {
    const rawPatch = value as Record<string, unknown>;
    const patch: Partial<Task> & { updatedAt?: string } = {};

    if (typeof rawPatch.title === "string") patch.title = rawPatch.title;
    if (typeof rawPatch.description === "string") patch.description = rawPatch.description;
    if (typeof rawPatch.groupId === "string") patch.groupId = rawPatch.groupId;
    if (typeof rawPatch.parentId === "string" || rawPatch.parentId === null) {
      patch.parentId = rawPatch.parentId;
    }
    if (typeof rawPatch.order === "number") patch.order = rawPatch.order;
    if (typeof rawPatch.completed === "boolean") patch.completed = rawPatch.completed;
    if (typeof rawPatch.completedAt === "string" || rawPatch.completedAt === null) {
      patch.completedAt = rawPatch.completedAt;
    }
    if (isTaskPriority(rawPatch.priority)) patch.priority = rawPatch.priority;
    if (typeof rawPatch.dueDate === "string" || rawPatch.dueDate === null) {
      patch.dueDate = rawPatch.dueDate;
    }
    if (typeof rawPatch.dueTime === "string" || rawPatch.dueTime === null) {
      patch.dueTime = rawPatch.dueTime;
    }
    if (typeof rawPatch.updatedAt === "string") patch.updatedAt = rawPatch.updatedAt;

    return Object.keys(patch).length > 0 ? patch : null;
  }

  if (event.type === "task_scheduled") {
    return {
      dueDate: typeof event.payload.dueDate === "string" ? event.payload.dueDate : null,
      dueTime: typeof event.payload.dueTime === "string" ? event.payload.dueTime : null,
      updatedAt: event.createdAt,
    };
  }

  if (event.type === "task_priority_changed" && isTaskPriority(event.payload.priority)) {
    return {
      priority: event.payload.priority,
      updatedAt: event.createdAt,
    };
  }

  return null;
}

function readGroupPatchPayload(value: unknown): (Partial<TaskGroup> & { updatedAt?: string }) | null {
  if (!value || typeof value !== "object") return null;

  const rawPatch = value as Record<string, unknown>;
  const patch: Partial<TaskGroup> & { updatedAt?: string } = {};

  if (typeof rawPatch.name === "string") patch.name = rawPatch.name;
  if (typeof rawPatch.order === "number") patch.order = rawPatch.order;
  if (typeof rawPatch.updatedAt === "string") patch.updatedAt = rawPatch.updatedAt;

  return Object.keys(patch).length > 0 ? patch : null;
}

function readHabitPatchPayload(value: unknown): (Partial<Habit> & { updatedAt?: string }) | null {
  if (!value || typeof value !== "object") return null;

  const rawPatch = value as Record<string, unknown>;
  const patch: Partial<Habit> & { updatedAt?: string } = {};

  if (typeof rawPatch.title === "string") patch.title = rawPatch.title;
  if (isHabitUnitType(rawPatch.unitType)) patch.unitType = rawPatch.unitType;
  if (typeof rawPatch.unitMinutes === "number") patch.unitMinutes = rawPatch.unitMinutes;
  if (isHabitColor(rawPatch.color)) patch.color = rawPatch.color;
  if (typeof rawPatch.order === "number") patch.order = rawPatch.order;
  if (typeof rawPatch.updatedAt === "string") patch.updatedAt = rawPatch.updatedAt;

  return Object.keys(patch).length > 0 ? patch : null;
}

function readStringArrayPayload(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function insertTaskAt(tasks: Task[], task: Task, index: number): Task[] {
  const nextTasks = tasks.filter((item) => item.id !== task.id);
  nextTasks.splice(index, 0, task);
  return nextTasks;
}

function applyRootOrderAndGroup(
  tasks: Task[],
  movedTaskId: TaskId,
  destinationGroupId: TaskGroupId,
  orderedDestinationRoots: Task[],
): Task[] {
  const now = new Date().toISOString();
  const destinationOrderById = new Map(
    orderedDestinationRoots.map((task, index) => [task.id, index]),
  );
  const descendantIds = collectDescendantIds(tasks, movedTaskId);

  return tasks.map((task) => {
    const isMovedTree = task.id === movedTaskId || descendantIds.has(task.id);
    const destinationOrder = destinationOrderById.get(task.id);

    if (!isMovedTree && destinationOrder === undefined) return task;

    return {
      ...task,
      groupId: isMovedTree ? destinationGroupId : task.groupId,
      parentId: task.id === movedTaskId ? null : task.parentId,
      order: destinationOrder ?? task.order,
      updatedAt: now,
    };
  });
}

function collectDescendantIds(tasks: Task[], taskId: TaskId): Set<TaskId> {
  const descendants = new Set<TaskId>();
  const queue = tasks.filter((task) => task.parentId === taskId).map((task) => task.id);

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || descendants.has(currentId)) continue;

    descendants.add(currentId);
    queue.push(...tasks.filter((task) => task.parentId === currentId).map((task) => task.id));
  }

  return descendants;
}

function sortTasksByOrder(first: Task, second: Task): number {
  return first.order - second.order || first.createdAt.localeCompare(second.createdAt);
}

function sortGroupsByOrder(first: TaskGroup, second: TaskGroup): number {
  return first.order - second.order || first.createdAt.localeCompare(second.createdAt);
}

function sortHabitsByOrder(first: Habit, second: Habit): number {
  return first.order - second.order || first.createdAt.localeCompare(second.createdAt);
}

function isTaskPriority(value: unknown): value is Task["priority"] {
  return value === "high" || value === "medium" || value === "low" || value === "none";
}

function isHabitUnitType(value: unknown): value is HabitUnitType {
  return value === "minutes" || value === "times";
}

function isHabitColor(value: unknown): value is HabitColor {
  return (
    value === "blue" ||
    value === "cyan" ||
    value === "green" ||
    value === "lime" ||
    value === "yellow" ||
    value === "orange" ||
    value === "red" ||
    value === "pink" ||
    value === "purple" ||
    value === "slate"
  );
}

function isActivityEventType(value: string): value is ActivityEventType {
  return (
    value === "task_created" ||
    value === "task_updated" ||
    value === "task_completed" ||
    value === "task_uncompleted" ||
    value === "task_deleted" ||
    value === "task_moved" ||
    value === "task_scheduled" ||
    value === "task_priority_changed" ||
    value === "group_created" ||
    value === "group_updated" ||
    value === "group_deleted" ||
    value === "habit_created" ||
    value === "habit_updated" ||
    value === "habit_deleted" ||
    value === "habit_checked" ||
    value === "habit_unchecked" ||
    value === "habit_reordered"
  );
}

function isActivityEntityType(value: string): value is ActivityEntityType {
  return value === "task" || value === "task_group" || value === "habit" || value === "habit_entry";
}

function compareIso(first: string, second: string): number {
  return first.localeCompare(second);
}
