import type { TaskSortMode } from "@/lib/task-sort";
import type { AppLanguage } from "@/types/user-settings";

type TaskSortLabels = {
  title: string;
  modes: Record<TaskSortMode, string>;
  descriptions: Record<TaskSortMode, string>;
};

const LABELS: Record<AppLanguage, TaskSortLabels> = {
  en: {
    title: "Sort",
    modes: { manual: "My order", created: "Newest", schedule: "Schedule", importance: "Importance" },
    descriptions: {
      manual: "Drag tasks into your own order",
      created: "Recently created tasks first",
      schedule: "Earlier schedules and deadlines first",
      importance: "Most important tasks first",
    },
  },
  ja: {
    title: "並び順",
    modes: { manual: "自分で並べた順", created: "新しい順", schedule: "日程順", importance: "重要度順" },
    descriptions: {
      manual: "ドラッグした順番で表示",
      created: "新しく作ったタスクから表示",
      schedule: "日程が近いタスクから表示",
      importance: "重要度が高いタスクから表示",
    },
  },
  "zh-CN": {
    title: "排序",
    modes: { manual: "自定义顺序", created: "最新创建", schedule: "日程顺序", importance: "重要程度" },
    descriptions: {
      manual: "按照拖动后的顺序显示",
      created: "最新创建的任务优先",
      schedule: "日程较近的任务优先",
      importance: "较重要的任务优先",
    },
  },
  "zh-TW": {
    title: "排序",
    modes: { manual: "自訂順序", created: "最新建立", schedule: "日程順序", importance: "重要程度" },
    descriptions: {
      manual: "依照拖曳後的順序顯示",
      created: "最新建立的任務優先",
      schedule: "日程較近的任務優先",
      importance: "較重要的任務優先",
    },
  },
};

export function getTaskSortLabels(language: AppLanguage): TaskSortLabels {
  return LABELS[language];
}
