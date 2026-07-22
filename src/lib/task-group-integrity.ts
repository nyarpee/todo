import type { TaskGroup } from "@/types/task";

export type TaskGroupIntegrityIssue =
  | { type: "duplicate-id"; groupId: string }
  | { type: "invalid-order"; groupId: string; order: number }
  | { type: "duplicate-order"; order: number };

export type TaskGroupIntegrityResult = {
  groups: TaskGroup[];
  issues: TaskGroupIntegrityIssue[];
  repaired: boolean;
};

/**
 * Checks persisted group data without changing group IDs. IDs are referenced by
 * tasks, so silently replacing one would risk moving tasks to the wrong group.
 * Order values, on the other hand, can be made contiguous without breaking any
 * relationship.
 */
export function inspectAndRepairTaskGroups(groups: TaskGroup[]): TaskGroupIntegrityResult {
  const issues: TaskGroupIntegrityIssue[] = [];
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();

  for (const group of groups) {
    if (seenIds.has(group.id)) issues.push({ type: "duplicate-id", groupId: group.id });
    seenIds.add(group.id);

    if (!Number.isSafeInteger(group.order) || group.order < 0) {
      issues.push({ type: "invalid-order", groupId: group.id, order: group.order });
    } else if (seenOrders.has(group.order)) {
      issues.push({ type: "duplicate-order", order: group.order });
    }
    seenOrders.add(group.order);
  }

  // A duplicate ID cannot normally exist in IndexedDB or Supabase, but if an
  // older import supplies one, report it and leave the records untouched. The
  // task-to-group relationship needs an explicit migration in that case.
  if (issues.some((issue) => issue.type === "duplicate-id")) {
    return { groups, issues, repaired: false };
  }

  const sorted = groups
    .map((group, sourceIndex) => ({ group, sourceIndex }))
    .sort((first, second) => {
      const firstOrder = Number.isSafeInteger(first.group.order) && first.group.order >= 0
        ? first.group.order
        : Number.MAX_SAFE_INTEGER;
      const secondOrder = Number.isSafeInteger(second.group.order) && second.group.order >= 0
        ? second.group.order
        : Number.MAX_SAFE_INTEGER;
      if (firstOrder !== secondOrder) return firstOrder - secondOrder;
      const createdAtOrder = first.group.createdAt.localeCompare(second.group.createdAt);
      if (createdAtOrder !== 0) return createdAtOrder;
      const idOrder = first.group.id.localeCompare(second.group.id);
      if (idOrder !== 0) return idOrder;
      return first.sourceIndex - second.sourceIndex;
    })
    .map(({ group }, order) => (group.order === order ? group : { ...group, order }));

  const repaired = sorted.some((group, index) => group !== groups[index]);
  return { groups: repaired ? sorted : groups, issues, repaired };
}
