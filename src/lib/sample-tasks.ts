import type { Task, UserId } from "@/types/task";
import { DEFAULT_MY_TASKS_GROUP_ID } from "./task-groups";

type SampleTaskSeed = {
  key: "addTask" | "addSubtask" | "editTitle" | "addDate" | "addPriority" | "useTree" | "addHabit";
  title: string;
  description: string;
  parentKey: SampleTaskSeed["key"] | null;
  order: number;
};

const SAMPLE_TASKS: SampleTaskSeed[] = [
  {
    key: "addTask",
    title: "Add your first task",
    description:
      "Use the + button in the lower-right corner to create a new task. Enter a title, save it, and it will appear in your Inbox.",
    parentKey: null,
    order: 0,
  },
  {
    key: "addSubtask",
    title: "Add a subtask",
    description:
      "Tap a task to open its detail sheet. Use Add subtask to break work into smaller steps.",
    parentKey: null,
    order: 1,
  },
  {
    key: "editTitle",
    title: "Edit the title",
    description: "Tap the title in the detail sheet to edit it directly.",
    parentKey: "addSubtask",
    order: 0,
  },
  {
    key: "addDate",
    title: "Add a date",
    description: "Tap No date in the detail sheet to set a date and time.",
    parentKey: "addSubtask",
    order: 1,
  },
  {
    key: "addPriority",
    title: "Add a priority",
    description: "Use Priority in the detail sheet to choose High, Medium, Low, or None.",
    parentKey: "addSubtask",
    order: 2,
  },
  {
    key: "useTree",
    title: "Try the tree canvas",
    description:
      "Press the tree icon on a task row to open that task as a canvas. Use the + on a node to grow new branches.",
    parentKey: null,
    order: 2,
  },
  {
    key: "addHabit",
    title: "Add a habit",
    description:
      "Open the Habit tab and press + to create a habit card. Choose the unit for 1 check and build progress little by little.",
    parentKey: null,
    order: 3,
  },
];

export function createSampleTasks(userId: UserId): Task[] {
  const now = new Date().toISOString();
  const ids = new Map<SampleTaskSeed["key"], string>(
    SAMPLE_TASKS.map((task) => [task.key, crypto.randomUUID()]),
  );

  return SAMPLE_TASKS.map((task) =>
    createTask(
      ids.get(task.key) ?? crypto.randomUUID(),
      userId,
      task.title,
      task.description,
      task.parentKey ? ids.get(task.parentKey) ?? null : null,
      task.order,
      false,
      now,
    ),
  );
}

function createTask(
  id: string,
  userId: UserId,
  title: string,
  description: string,
  parentId: string | null,
  order: number,
  completed: boolean,
  date: string,
): Task {
  return {
    id,
    userId,
    title,
    description,
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
