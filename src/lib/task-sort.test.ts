import { describe, expect, it } from "vitest";
import type { ComposeDraft } from "@/types/compose-session";
import type { TaskNode } from "@/types/task";
import { getComposeInsertIndex, sortTaskRoots } from "./task-sort";

describe("task sort", () => {
  it("keeps manual order untouched", () => {
    const tasks = [task("second", { order: 1 }), task("first", { order: 0 })];
    expect(sortTaskRoots(tasks, "manual").map((item) => item.id)).toEqual(["second", "first"]);
    expect(sortTaskRoots(tasks, "manual")).toBe(tasks);
  });

  it("sorts newest tasks first", () => {
    const tasks = [
      task("old", { createdAt: "2026-07-01T00:00:00.000Z" }),
      task("new", { createdAt: "2026-07-02T00:00:00.000Z" }),
    ];
    expect(sortTaskRoots(tasks, "created").map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("sorts dated tasks before undated tasks and deadlines before plans on the same day", () => {
    const tasks = [
      task("none"),
      task("plan", { dueDate: "2026-07-23", scheduleType: "scheduled" }),
      task("deadline", { dueDate: "2026-07-23", scheduleType: "deadline" }),
      task("earlier", { dueDate: "2026-07-22" }),
    ];
    expect(sortTaskRoots(tasks, "schedule").map((item) => item.id)).toEqual([
      "earlier", "deadline", "plan", "none",
    ]);
  });

  it("places a composing task where its importance will sort", () => {
    const roots = sortTaskRoots([
      task("high", { priority: "high" }),
      task("low", { priority: "low" }),
      task("none"),
    ], "importance");
    const draft: ComposeDraft = {
      title: "",
      dueDate: null,
      dueTime: null,
      scheduleType: "deadline",
      priority: "medium",
    };
    expect(getComposeInsertIndex(roots, draft, "importance")).toBe(1);
  });
});

function task(id: string, overrides: Partial<TaskNode> = {}): TaskNode {
  return {
    id,
    userId: "user",
    title: id,
    description: "",
    groupId: "group",
    parentId: null,
    order: 0,
    completed: false,
    completedAt: null,
    priority: "none",
    dueDate: null,
    dueTime: null,
    scheduleType: "deadline",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    children: [],
    depth: 0,
    progress: 0,
    ...overrides,
  };
}
