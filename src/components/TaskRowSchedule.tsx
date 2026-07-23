"use client";

import {
  diffDaysFromKey,
  fromDateKey,
  getRelativeDayLabel,
  getRelativeHourLabel,
  getRemainingHourCount,
  getTodayKey,
} from "@/lib/date-utils";
import type { TaskNode } from "@/types/task";

type TaskRowScheduleProps = {
  task: Pick<TaskNode, "dueDate" | "dueTime" | "scheduleType" | "completed">;
  locale: string;
  progress?: number | null;
};

export function TaskRowSchedule({ task, locale, progress = null }: TaskRowScheduleProps) {
  if (!task.dueDate && progress === null) return null;

  const dayDifference = task.dueDate ? diffDaysFromKey(task.dueDate, getTodayKey()) : 0;
  const date = task.dueDate
    ? new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).format(
        fromDateKey(task.dueDate),
      )
    : null;
  const isDeadline = task.scheduleType === "deadline";
  const dateLabel = date ? formatDateLabel(date, isDeadline, locale) : null;
  const remainingHours = task.dueDate
    ? getRemainingHourCount(task.dueDate, task.dueTime)
    : null;
  const relativeLabel = date && !task.completed
    ? remainingHours !== null
      ? getRelativeHourLabel(remainingHours, locale)
      : getRelativeDayLabel(dayDifference, locale)
    : null;
  const titleParts = [dateLabel, relativeLabel, progress !== null ? `${progress}%` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      className={[
        "taskRowSchedule",
        task.dueDate && dayDifference === 0 ? "isToday" : "",
        task.dueDate && dayDifference === 1 ? "isTomorrow" : "",
        task.dueDate && dayDifference < 0 && !task.completed ? "isOverdue" : "",
      ].filter(Boolean).join(" ")}
      title={titleParts}
    >
      {dateLabel ? <span className="taskRowDate">{dateLabel}</span> : null}
      {relativeLabel ? <span className="taskRowScheduleRelative">{relativeLabel}</span> : null}
      {progress !== null ? <span className="taskRowProgressValue">{progress}%</span> : null}
    </span>
  );
}

function formatDateLabel(date: string, deadline: boolean, locale: string): string {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("ja")) return `${date}${deadline ? "までに" : "に"}`;
  if (normalized.startsWith("en")) return `${deadline ? "By" : "On"} ${date}`;
  return `${date}${deadline ? "前" : "當天"}`;
}
