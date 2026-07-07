import type { Task, UserId } from "@/types/task";
import { DEFAULT_MY_TASKS_GROUP_ID } from "./task-groups";

export function createSampleTasks(userId: UserId): Task[] {
  const now = new Date().toISOString();
  const rootReact = crypto.randomUUID();
  const hooks = crypto.randomUUID();
  const appTask = crypto.randomUUID();

  return [
    createTask(rootReact, userId, "React\u3092\u52c9\u5f37\u3059\u308b", null, 0, false, now),
    createTask(crypto.randomUUID(), userId, "JSX\u3092\u7406\u89e3\u3059\u308b", rootReact, 0, false, now),
    createTask(hooks, userId, "Hooks\u3092\u7406\u89e3\u3059\u308b", rootReact, 1, false, now),
    createTask(crypto.randomUUID(), userId, "useState", hooks, 0, true, now),
    createTask(crypto.randomUUID(), userId, "useEffect", hooks, 1, false, now),
    createTask(appTask, userId, "Todo\u30a2\u30d7\u30ea\u3092\u4f5c\u308b", rootReact, 2, false, now),
    createTask(crypto.randomUUID(), userId, "\u30c7\u30fc\u30bf\u69cb\u9020\u3092\u4f5c\u308b", appTask, 0, true, now),
    createTask(crypto.randomUUID(), userId, "List / Tree UI\u3092\u4f5c\u308b", appTask, 1, false, now),
  ];
}

function createTask(
  id: string,
  userId: UserId,
  title: string,
  parentId: string | null,
  order: number,
  completed: boolean,
  date: string,
): Task {
  return {
    id,
    userId,
    title,
    description: "",
    groupId: DEFAULT_MY_TASKS_GROUP_ID,
    parentId,
    order,
    completed,
    completedAt: completed ? date : null,
    priority: "none",
    dueDate: null,
    dueTime: null,
    createdAt: date,
    updatedAt: date,
  };
}
