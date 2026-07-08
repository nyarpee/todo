"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TaskId, TaskNode } from "@/types/task";
import {
  buildCalendarDays,
  getDisplayDate,
  getMonthLabel,
  getTodayKey,
  getTomorrowKey,
  sortScheduleValues,
} from "@/lib/date-utils";
import { getHighestPriority, getPriorityClass } from "@/lib/priority";
import { ProgressBar } from "./ProgressBar";

type CalendarTabViewProps = {
  tasks: TaskNode[];
  onSelectTask: (taskId: TaskId) => void;
};

export function CalendarTabView({ tasks, onSelectTask }: CalendarTabViewProps) {
  const { messages: text } = useLanguage();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(getTodayKey());
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const agendaGroupRefs = useRef(new Map<string, HTMLElement>());
  const todayKey = getTodayKey();
  const tomorrowKey = getTomorrowKey();
  const scheduledTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.dueDate !== null)
        .slice()
        .sort((first, second) => sortAgendaTasks(first, second, todayKey)),
    [tasks, todayKey],
  );
  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();

    for (const task of scheduledTasks) {
      if (!task.dueDate) continue;
      counts.set(task.dueDate, (counts.get(task.dueDate) ?? 0) + 1);
    }

    return counts;
  }, [scheduledTasks]);
  const priorityByDate = useMemo(() => {
    const tasksByDate = new Map<string, TaskNode[]>();

    for (const task of scheduledTasks) {
      if (!task.dueDate) continue;
      tasksByDate.set(task.dueDate, [...(tasksByDate.get(task.dueDate) ?? []), task]);
    }

    return new Map(
      Array.from(tasksByDate, ([date, dateTasks]) => [date, getHighestPriority(dateTasks)]),
    );
  }, [scheduledTasks]);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const groupedTasks = useMemo(
    () => groupTasksByDate(scheduledTasks),
    [scheduledTasks],
  );

  function moveMonth(offset: number) {
    setVisibleMonth((currentMonth) => {
      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + offset);
      return nextMonth;
    });
  }

  function handleSelectDate(date: string, taskCount: number) {
    setSelectedDate(date);
    if (taskCount === 0) return;

    const agendaGroup = agendaGroupRefs.current.get(date);
    if (!agendaGroup) return;

    agendaGroup.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setHighlightedDate(date);
    window.setTimeout(() => setHighlightedDate((current) => (current === date ? null : current)), 760);
  }

  return (
    <section className="calendarTabView">
      <section className="calendarAgenda">
        <div className="calendarSectionHeader">
          <h2>{text.calendar.scheduled}</h2>
          <span>{scheduledTasks.length}</span>
        </div>
        {scheduledTasks.length === 0 ? (
          <p className="placeholderText">{text.calendar.empty}</p>
        ) : (
          <div className="agendaList">
            {groupedTasks.map((group) => (
              <section
                ref={(element) => {
                  if (element) {
                    agendaGroupRefs.current.set(group.date, element);
                    return;
                  }
                  agendaGroupRefs.current.delete(group.date);
                }}
                className={group.date === highlightedDate ? "agendaGroup isHighlighted" : "agendaGroup"}
                key={group.date}
              >
                <h3>{getAgendaDateLabel(group.date, todayKey, tomorrowKey, {
                  today: text.common.today,
                  tomorrow: text.common.tomorrow,
                  locale: text.common.locale,
                })}</h3>
                <div className="agendaGroupRows">
                  {group.tasks.map((task) => (
                    <button
                      className="agendaRow"
                      key={task.id}
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                    >
                      <span className="agendaTime">{task.dueTime ?? "--:--"}</span>
                      <span className={task.completed ? "agendaTitle isCompleted" : "agendaTitle"}>
                        <span
                          className={`priorityDot taskPriorityDot ${getPriorityClass(task.priority)}`}
                          aria-hidden="true"
                        />
                        {task.title}
                      </span>
                      <ProgressBar value={task.progress} />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="calendarMonthPanel">
        <div className="calendarHeader">
          <button type="button" aria-label={text.common.previousMonth} onClick={() => moveMonth(-1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <h2>{getMonthLabel(visibleMonth, text.common.locale)}</h2>
          <button type="button" aria-label={text.common.nextMonth} onClick={() => moveMonth(1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="calendarWeekdays" aria-hidden="true">
          {text.common.weekdays.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="calendarGrid calendarGridReadOnly">
          {calendarDays.map((day) => {
            const taskCount = countsByDate.get(day.date) ?? 0;
            const priority = priorityByDate.get(day.date) ?? "none";

            return (
              <button
                className={[
                  "calendarDay calendarDayReadOnly",
                  day.isCurrentMonth ? "" : "isMuted",
                  day.isToday ? "isToday" : "",
                  day.date === selectedDate ? "isSelected" : "",
                  taskCount > 0 ? "hasTasks" : "",
                ].filter(Boolean).join(" ")}
                key={day.date}
                type="button"
                onClick={() => handleSelectDate(day.date, taskCount)}
              >
                <span>{day.dayOfMonth}</span>
                {taskCount > 0 ? (
                  <small
                    className={getPriorityClass(priority)}
                    aria-label={text.calendar.scheduledTasks.replace("{count}", String(taskCount))}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

type AgendaGroup = {
  date: string;
  tasks: TaskNode[];
};

function groupTasksByDate(tasks: TaskNode[]): AgendaGroup[] {
  const groups = new Map<string, TaskNode[]>();

  for (const task of tasks) {
    if (!task.dueDate) continue;
    groups.set(task.dueDate, [...(groups.get(task.dueDate) ?? []), task]);
  }

  return Array.from(groups, ([date, groupTasks]) => ({
    date,
    tasks: groupTasks,
  }));
}

function getAgendaDateLabel(
  date: string,
  todayKey: string,
  tomorrowKey: string,
  labels: { today: string; tomorrow: string; locale: string },
): string {
  if (date === todayKey) return labels.today;
  if (date === tomorrowKey) return labels.tomorrow;
  return getDisplayDate(date, labels.locale);
}

function sortAgendaTasks(
  first: TaskNode,
  second: TaskNode,
  todayKey: string,
): number {
  const firstDate = first.dueDate;
  const secondDate = second.dueDate;
  const firstIsPast = firstDate !== null && firstDate < todayKey;
  const secondIsPast = secondDate !== null && secondDate < todayKey;

  if (firstIsPast !== secondIsPast) {
    return firstIsPast ? 1 : -1;
  }

  if (
    firstIsPast &&
    secondIsPast &&
    firstDate !== null &&
    secondDate !== null &&
    firstDate !== secondDate
  ) {
    return secondDate.localeCompare(firstDate);
  }

  return sortScheduleValues(firstDate, first.dueTime, secondDate, second.dueTime);
}
