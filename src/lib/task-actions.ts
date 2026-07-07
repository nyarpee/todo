import type { CreateTaskInput, Task, TaskId, UpdateTaskInput } from "../types/task";
import { DEFAULT_MY_TASKS_GROUP_ID } from "./task-groups";
import { getDescendantIds, isDescendant } from "./task-tree";

type Clock = () => string;
type IdGenerator = () => string;

const defaultClock: Clock = () => new Date().toISOString();
const defaultIdGenerator: IdGenerator = () => crypto.randomUUID();

export type TaskActionOptions = {
  now?: Clock;
  generateId?: IdGenerator;
};

export function addTask(
  tasks: Task[],
  input: CreateTaskInput,
  options: TaskActionOptions = {},
): Task[] {
  const now = (options.now ?? defaultClock)();
  const generateId = options.generateId ?? defaultIdGenerator;
  const parentId = input.parentId ?? null;

  assertParentExists(tasks, parentId);

  const parentTask = parentId ? findTaskOrThrow(tasks, parentId) : null;
  const nextOrder = getNextOrder(tasks, parentId);
  const task: Task = {
    id: generateId(),
    userId: input.userId,
    title: input.title.trim(),
    description: input.description ?? "",
    groupId: parentTask?.groupId ?? input.groupId ?? DEFAULT_MY_TASKS_GROUP_ID,
    parentId,
    order: nextOrder,
    completed: false,
    completedAt: null,
    priority: input.priority ?? "none",
    dueDate: input.dueDate ?? null,
    dueTime: input.dueTime ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (task.title.length === 0) {
    throw new Error("Task title cannot be empty.");
  }

  return [...tasks, task];
}

export function updateTask(
  tasks: Task[],
  taskId: TaskId,
  patch: UpdateTaskInput,
  options: Pick<TaskActionOptions, "now"> = {},
): Task[] {
  const existingTask = findTaskOrThrow(tasks, taskId);
  const now = (options.now ?? defaultClock)();

  if (patch.parentId !== undefined) {
    assertCanMove(tasks, taskId, patch.parentId);
  }

  if (patch.title !== undefined && patch.title.trim().length === 0) {
    throw new Error("Task title cannot be empty.");
  }

  return tasks.map((task) => {
    if (task.id !== existingTask.id) return task;

    return {
      ...task,
      ...patch,
      title: patch.title === undefined ? task.title : patch.title.trim(),
      updatedAt: now,
    };
  });
}

export function toggleTask(
  tasks: Task[],
  taskId: TaskId,
  options: Pick<TaskActionOptions, "now"> = {},
): Task[] {
  const task = findTaskOrThrow(tasks, taskId);
  const nextCompleted = !task.completed;
  const now = (options.now ?? defaultClock)();

  return updateTask(
    tasks,
    taskId,
    {
      completed: nextCompleted,
      completedAt: nextCompleted ? now : null,
    },
    { now: () => now },
  );
}

export function toggleTaskAndSyncAncestors(
  tasks: Task[],
  taskId: TaskId,
  options: Pick<TaskActionOptions, "now"> = {},
): Task[] {
  const nextTasks = toggleTask(tasks, taskId, options);
  return syncAncestorCompletion(nextTasks, taskId, options);
}

export function renameTask(
  tasks: Task[],
  taskId: TaskId,
  title: string,
  options: Pick<TaskActionOptions, "now"> = {},
): Task[] {
  return updateTask(tasks, taskId, { title }, options);
}

export function updateTaskDescription(
  tasks: Task[],
  taskId: TaskId,
  description: string,
  options: Pick<TaskActionOptions, "now"> = {},
): Task[] {
  return updateTask(tasks, taskId, { description }, options);
}

export function updateTaskSchedule(
  tasks: Task[],
  taskId: TaskId,
  dueDate: string | null,
  dueTime: string | null,
  options: Pick<TaskActionOptions, "now"> = {},
): Task[] {
  return updateTask(tasks, taskId, { dueDate, dueTime }, options);
}

export function updateTaskPriority(
  tasks: Task[],
  taskId: TaskId,
  priority: Task["priority"],
  options: Pick<TaskActionOptions, "now"> = {},
): Task[] {
  return updateTask(tasks, taskId, { priority }, options);
}

export function syncAncestorCompletion(
  tasks: Task[],
  changedTaskId: TaskId,
  options: Pick<TaskActionOptions, "now"> = {},
): Task[] {
  const now = (options.now ?? defaultClock)();
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  let currentTask = tasksById.get(changedTaskId);
  let nextTasks = tasks;

  while (currentTask?.parentId) {
    const parent = tasksById.get(currentTask.parentId);
    if (!parent) break;

    const children = Array.from(tasksById.values()).filter(
      (task) => task.parentId === parent.id,
    );
    const completed = children.length > 0 && children.every((child) => child.completed);

    if (parent.completed !== completed) {
      const nextCompletedAt = completed ? now : null;
      const updatedParent = {
        ...parent,
        completed,
        completedAt: nextCompletedAt,
        updatedAt: now,
      };

      tasksById.set(parent.id, updatedParent);
      nextTasks = nextTasks.map((task) => (task.id === parent.id ? updatedParent : task));
    }

    currentTask = tasksById.get(parent.id);
  }

  return nextTasks;
}

export function deleteTask(tasks: Task[], taskId: TaskId): Task[] {
  findTaskOrThrow(tasks, taskId);

  const idsToDelete = getDescendantIds(tasks, taskId);
  idsToDelete.add(taskId);

  return tasks.filter((task) => !idsToDelete.has(task.id));
}

export function moveTask(
  tasks: Task[],
  taskId: TaskId,
  newParentId: TaskId | null,
  newOrder: number,
  options: Pick<TaskActionOptions, "now"> = {},
): Task[] {
  assertCanMove(tasks, taskId, newParentId);

  return updateTask(
    tasks,
    taskId,
    {
      parentId: newParentId,
      order: newOrder,
    },
    options,
  );
}

function getNextOrder(tasks: Task[], parentId: TaskId | null): number {
  const siblingOrders = tasks
    .filter((task) => task.parentId === parentId)
    .map((task) => task.order);

  if (siblingOrders.length === 0) return 0;

  return Math.max(...siblingOrders) + 1;
}

function assertParentExists(tasks: Task[], parentId: TaskId | null): void {
  if (parentId === null) return;

  findTaskOrThrow(tasks, parentId);
}

function assertCanMove(
  tasks: Task[],
  taskId: TaskId,
  newParentId: TaskId | null,
): void {
  findTaskOrThrow(tasks, taskId);
  assertParentExists(tasks, newParentId);

  if (newParentId === null) return;

  if (taskId === newParentId) {
    throw new Error("Task cannot be moved under itself.");
  }

  if (isDescendant(tasks, taskId, newParentId)) {
    throw new Error("Task cannot be moved under its descendant.");
  }
}

function findTaskOrThrow(tasks: Task[], taskId: TaskId): Task {
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  return task;
}
