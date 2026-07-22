import { describe, expect, it } from "vitest";
import { inspectAndRepairTaskGroups } from "./task-group-integrity";
import type { TaskGroup } from "@/types/task";

function group(id: string, order: number, createdAt: string): TaskGroup {
  return { id, userId: "user", name: id, order, createdAt, updatedAt: createdAt };
}

describe("inspectAndRepairTaskGroups", () => {
  it("repairs duplicate and non-contiguous order values deterministically", () => {
    const result = inspectAndRepairTaskGroups([
      group("later", 4, "2026-01-02T00:00:00.000Z"),
      group("second", 0, "2026-01-02T00:00:00.000Z"),
      group("first", 0, "2026-01-01T00:00:00.000Z"),
    ]);

    expect(result.repaired).toBe(true);
    expect(result.groups.map(({ id, order }) => [id, order])).toEqual([
      ["first", 0],
      ["second", 1],
      ["later", 2],
    ]);
    expect(result.issues).toContainEqual({ type: "duplicate-order", order: 0 });
  });

  it("reports duplicate IDs without guessing how task references should move", () => {
    const groups = [
      group("same", 0, "2026-01-01T00:00:00.000Z"),
      group("same", 1, "2026-01-02T00:00:00.000Z"),
    ];
    const result = inspectAndRepairTaskGroups(groups);

    expect(result.repaired).toBe(false);
    expect(result.groups).toBe(groups);
    expect(result.issues).toContainEqual({ type: "duplicate-id", groupId: "same" });
  });
});
