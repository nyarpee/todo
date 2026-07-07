import type { Task, UserId } from "@/types/task";
import { DEFAULT_MY_TASKS_GROUP_ID } from "./task-groups";

export function createSampleTasks(userId: UserId): Task[] {
  const now = new Date().toISOString();
  const addTask = crypto.randomUUID();
  const addSubtask = crypto.randomUUID();
  const editTitle = crypto.randomUUID();
  const addDate = crypto.randomUUID();
  const addPriority = crypto.randomUUID();
  const useTree = crypto.randomUUID();
  const addHabit = crypto.randomUUID();

  return [
    createTask(
      addTask,
      userId,
      "タスクを追加してみよう",
      "右下の+ボタンから新しいタスクを作れます。タイトルを書いて保存すると、Inboxに追加されます。",
      null,
      0,
      false,
      now,
    ),
    createTask(
      addSubtask,
      userId,
      "サブタスクを追加してみよう",
      "タスクをタップすると詳細ページが開きます。詳細ページのAdd subtaskから、作業を小さく分けられます。",
      null,
      1,
      false,
      now,
    ),
    createTask(
      editTitle,
      userId,
      "タイトルを編集してみる",
      "詳細ページのタイトルをタップすると、そのまま編集できます。",
      addSubtask,
      0,
      false,
      now,
    ),
    createTask(
      addDate,
      userId,
      "日付を追加してみる",
      "詳細ページのNo dateをタップすると、日付と時間を設定できます。",
      addSubtask,
      1,
      false,
      now,
    ),
    createTask(
      addPriority,
      userId,
      "優先度を追加してみる",
      "詳細ページのPriorityから、High / Medium / Low / Noneを選べます。",
      addSubtask,
      2,
      false,
      now,
    ),
    createTask(
      useTree,
      userId,
      "Treeを使ってみよう",
      "タスク行のTreeアイコンを押すと、そのタスクを中心にキャンバス表示できます。ノードの+から枝を伸ばせます。",
      null,
      2,
      false,
      now,
    ),
    createTask(
      addHabit,
      userId,
      "Habitを追加してみよう",
      "下のHabitタブで+を押すと、習慣カードを作れます。1 checkの単位を決めて、少しずつ積み上げられます。",
      null,
      3,
      false,
      now,
    ),
  ];
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
