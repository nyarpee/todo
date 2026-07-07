import type { Task, TaskId, TaskNode } from "../types/task";

export function buildTaskTree(tasks: Task[]): TaskNode[] {
  const nodesById = new Map<TaskId, TaskNode>();

  for (const task of tasks) {
    nodesById.set(task.id, {
      ...task,
      children: [],
      depth: 0,
      progress: 0,
    });
  }

  const roots: TaskNode[] = [];

  for (const node of nodesById.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodesById.get(node.parentId);

    if (!parent) {
      roots.push({ ...node, parentId: null });
      continue;
    }

    parent.children.push(node);
  }

  sortNodes(roots);
  assignDepthAndProgress(roots, 0);

  return roots;
}

export function flattenTaskTree(nodes: TaskNode[]): TaskNode[] {
  const flattened: TaskNode[] = [];

  for (const node of nodes) {
    flattened.push(node);
    flattened.push(...flattenTaskTree(node.children));
  }

  return flattened;
}

export function getDescendantIds(tasks: Task[], taskId: TaskId): Set<TaskId> {
  const childIdsByParentId = new Map<TaskId, TaskId[]>();

  for (const task of tasks) {
    if (task.parentId === null) continue;

    const childIds = childIdsByParentId.get(task.parentId) ?? [];
    childIds.push(task.id);
    childIdsByParentId.set(task.parentId, childIds);
  }

  const descendants = new Set<TaskId>();
  const queue = [...(childIdsByParentId.get(taskId) ?? [])];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || descendants.has(currentId)) continue;

    descendants.add(currentId);
    queue.push(...(childIdsByParentId.get(currentId) ?? []));
  }

  return descendants;
}

export function isDescendant(
  tasks: Task[],
  possibleAncestorId: TaskId,
  possibleDescendantId: TaskId,
): boolean {
  return getDescendantIds(tasks, possibleAncestorId).has(possibleDescendantId);
}

function sortNodes(nodes: TaskNode[]): void {
  nodes.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));

  for (const node of nodes) {
    sortNodes(node.children);
  }
}

function assignDepthAndProgress(nodes: TaskNode[], depth: number): void {
  for (const node of nodes) {
    node.depth = depth;
    assignDepthAndProgress(node.children, depth + 1);
    node.progress = calculateNodeProgress(node);
  }
}

function calculateNodeProgress(node: TaskNode): number {
  if (node.children.length === 0) {
    return node.completed ? 100 : 0;
  }

  const total = node.children.reduce((sum, child) => sum + child.progress, 0);
  return Math.round(total / node.children.length);
}
