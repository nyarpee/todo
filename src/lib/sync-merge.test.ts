import { describe, expect, it } from "vitest";
import { mergeSyncSnapshots } from "./sync-merge";
import type { ActivityEvent } from "@/types/activity";
import type { Task, TaskGroup } from "@/types/task";

const group: TaskGroup = {
  id: "group",
  userId: "user",
  name: "Tasks",
  order: 0,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function task(title: string, updatedAt: string): Task {
  return {
    id: "task",
    userId: "user",
    title,
    description: "",
    groupId: group.id,
    parentId: null,
    order: 0,
    completed: false,
    completedAt: null,
    priority: "none",
    dueDate: null,
    dueTime: null,
    scheduleType: "deadline",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt,
  };
}

describe("mergeSyncSnapshots", () => {
  it("keeps the phone field proven by a shared activity event even when a stale cloud row has a later receipt time", () => {
    const phoneEdit: ActivityEvent = {
      id: "phone-edit",
      userId: "user",
      type: "task_updated",
      entityType: "task",
      entityId: "task",
      clientId: "phone",
      payload: { fields: ["title"] },
      createdAt: "2026-07-20T10:00:00.000Z",
    };

    const merged = mergeSyncSnapshots({
      local: {
        groups: [group],
        tasks: [task("Newest phone title", "2026-07-20T10:00:00.000Z")],
        habits: [],
        habitEntries: [],
        activityEvents: [phoneEdit],
      },
      remote: {
        groups: [group],
        tasks: [task("Older desktop title", "2026-07-23T10:00:00.000Z")],
        habits: [],
        habitEntries: [],
        activityEvents: [phoneEdit],
      },
    });

    expect(merged.tasks[0]?.title).toBe("Newest phone title");
  });
});
