import { describe, expect, it } from "vitest";
import type { Task } from "../types/task";
import { DEFAULT_MY_TASKS_GROUP_ID } from "./task-groups";
import {
  addTask,
  deleteTask,
  moveTask,
  syncAncestorCompletion,
  toggleTask,
} from "./task-actions";
import { buildTaskTree, flattenTaskTree } from "./task-tree";

const now = () => "2026-07-05T00:00:00.000Z";

describe("task tree", () => {
  it("builds ordered task nodes from flat tasks", () => {
    const tasks = createSampleTasks();

    const roots = buildTaskTree(tasks);
    const flattened = flattenTaskTree(roots);

    expect(roots).toHaveLength(1);
    expect(roots[0]?.title).toBe("Learn React");
    expect(flattened.map((task) => [task.title, task.depth])).toEqual([
      ["Learn React", 0],
      ["JSX", 1],
      ["Hooks", 1],
      ["useState", 2],
      ["useEffect", 2],
    ]);
  });

  it("calculates progress from descendant completion", () => {
    const tasks = createSampleTasks();

    const roots = buildTaskTree(tasks);
    const root = roots[0];
    const hooks = root?.children[1];

    expect(hooks?.progress).toBe(50);
    expect(root?.progress).toBe(25);
  });

  it("adds a task under a parent", () => {
    const tasks = createSampleTasks();

    const nextTasks = addTask(
      tasks,
      {
        userId: "user-1",
        title: "Build app",
        parentId: "task-root",
      },
      { now, generateId: () => "task-build-app" },
    );

    const addedTask = nextTasks.find((task) => task.id === "task-build-app");

    expect(addedTask).toMatchObject({
      parentId: "task-root",
      order: 2,
      completed: false,
    });
  });

  it("toggles a leaf task", () => {
    const tasks = createSampleTasks();

    const nextTasks = toggleTask(tasks, "task-effect", { now });

    expect(nextTasks.find((task) => task.id === "task-effect")?.completed).toBe(true);
  });

  it("deletes descendants with the selected task", () => {
    const tasks = createSampleTasks();

    const nextTasks = deleteTask(tasks, "task-hooks");

    expect(nextTasks.map((task) => task.id)).toEqual(["task-root", "task-jsx"]);
  });

  it("prevents moving a task under its descendant", () => {
    const tasks = createSampleTasks();

    expect(() => moveTask(tasks, "task-root", "task-state", 0)).toThrow(
      "Task cannot be moved under its descendant.",
    );
  });

  it("syncs parent completion from completed children", () => {
    const tasks = createSampleTasks().map((task) =>
      task.id === "task-effect" ? { ...task, completed: true } : task,
    );

    const nextTasks = syncAncestorCompletion(tasks, "task-effect", { now });

    expect(nextTasks.find((task) => task.id === "task-hooks")?.completed).toBe(true);
  });
});

function createSampleTasks(): Task[] {
  return [
    createTask({
      id: "task-root",
      title: "Learn React",
      parentId: null,
      order: 0,
      completed: false,
    }),
    createTask({
      id: "task-hooks",
      title: "Hooks",
      parentId: "task-root",
      order: 1,
      completed: false,
    }),
    createTask({
      id: "task-jsx",
      title: "JSX",
      parentId: "task-root",
      order: 0,
      completed: false,
    }),
    createTask({
      id: "task-state",
      title: "useState",
      parentId: "task-hooks",
      order: 0,
      completed: true,
    }),
    createTask({
      id: "task-effect",
      title: "useEffect",
      parentId: "task-hooks",
      order: 1,
      completed: false,
    }),
  ];
}

function createTask(overrides: Partial<Task>): Task {
  return {
    id: "task",
    userId: "user-1",
    title: "Task",
    description: "",
    groupId: DEFAULT_MY_TASKS_GROUP_ID,
    parentId: null,
    order: 0,
    completed: false,
    completedAt: null,
    priority: "none",
    dueDate: null,
    dueTime: null,
    scheduleType: "deadline",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}
