import type { Task, UserId } from "@/types/task";
import type { AppLanguage } from "@/types/user-settings";
import { DEFAULT_MY_TASKS_GROUP_ID } from "./task-groups";

type SampleTaskKey =
  | "addTask"
  | "addSubtask"
  | "editTitle"
  | "addDate"
  | "addPriority"
  | "useTree"
  | "addHabit";

type SampleTaskSeed = {
  key: SampleTaskKey;
  title: string;
  description: string;
  parentKey: SampleTaskKey | null;
  order: number;
};

const SAMPLE_TASKS_BY_LANGUAGE: Record<AppLanguage, SampleTaskSeed[]> = {
  en: [
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
  ],
  ja: [
    {
      key: "addTask",
      title: "最初のタスクを追加しよう",
      description:
        "右下の + ボタンから新しいタスクを作成できます。タイトルを入力して保存すると Inbox に表示されます。",
      parentKey: null,
      order: 0,
    },
    {
      key: "addSubtask",
      title: "サブタスクを追加しよう",
      description:
        "タスクをタップすると詳細シートが開きます。Add subtask から作業を小さな手順に分けられます。",
      parentKey: null,
      order: 1,
    },
    {
      key: "editTitle",
      title: "タイトルを編集しよう",
      description: "詳細シートのタイトルをタップすると、そのまま編集できます。",
      parentKey: "addSubtask",
      order: 0,
    },
    {
      key: "addDate",
      title: "日付を追加しよう",
      description: "詳細シートの日付欄をタップすると、日付と時間を設定できます。",
      parentKey: "addSubtask",
      order: 1,
    },
    {
      key: "addPriority",
      title: "優先度を追加しよう",
      description: "詳細シートの優先度から High、Medium、Low、None を選べます。",
      parentKey: "addSubtask",
      order: 2,
    },
    {
      key: "useTree",
      title: "ツリーキャンバスを使ってみよう",
      description:
        "タスク行のツリーアイコンを押すと、そのタスクをキャンバスで表示できます。ノードの + から枝を伸ばせます。",
      parentKey: null,
      order: 2,
    },
    {
      key: "addHabit",
      title: "習慣を追加しよう",
      description:
        "Habit タブを開いて + を押すと、習慣カードを作成できます。1 check の単位を選んで少しずつ積み上げましょう。",
      parentKey: null,
      order: 3,
    },
  ],
  zh: [
    {
      key: "addTask",
      title: "添加你的第一个任务",
      description:
        "使用右下角的 + 按钮创建新任务。输入标题并保存后，它会出现在 Inbox 中。",
      parentKey: null,
      order: 0,
    },
    {
      key: "addSubtask",
      title: "添加子任务",
      description:
        "点击任务可以打开详情面板。使用 Add subtask 把工作拆成更小的步骤。",
      parentKey: null,
      order: 1,
    },
    {
      key: "editTitle",
      title: "编辑标题",
      description: "点击详情面板中的标题即可直接编辑。",
      parentKey: "addSubtask",
      order: 0,
    },
    {
      key: "addDate",
      title: "添加日期",
      description: "点击详情面板中的日期栏，可以设置日期和时间。",
      parentKey: "addSubtask",
      order: 1,
    },
    {
      key: "addPriority",
      title: "添加优先级",
      description: "在详情面板中使用优先级，选择 High、Medium、Low 或 None。",
      parentKey: "addSubtask",
      order: 2,
    },
    {
      key: "useTree",
      title: "试试树形画布",
      description:
        "点击任务行中的树形图标，可以把该任务作为画布打开。使用节点上的 + 来添加新的分支。",
      parentKey: null,
      order: 2,
    },
    {
      key: "addHabit",
      title: "添加习惯",
      description:
        "打开 Habit 标签并点击 +，可以创建习惯卡片。选择 1 check 的单位，逐步积累进度。",
      parentKey: null,
      order: 3,
    },
  ],
};

export function createSampleTasks(userId: UserId, language: AppLanguage = "en"): Task[] {
  const now = new Date().toISOString();
  const sampleTasks = SAMPLE_TASKS_BY_LANGUAGE[language] ?? SAMPLE_TASKS_BY_LANGUAGE.en;
  const ids = new Map<SampleTaskKey, string>(
    sampleTasks.map((task) => [task.key, crypto.randomUUID()]),
  );

  return sampleTasks.map((task) =>
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
