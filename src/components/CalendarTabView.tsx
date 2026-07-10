"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TaskId, TaskNode } from "@/types/task";
import {
  buildCalendarDays,
  diffDaysFromKey,
  fromDateKey,
  getDisplayDate,
  getMonthLabel,
  getMonthLabelFromKey,
  getTodayKey,
  getWeekdayIndexFromKey,
  sortScheduleValues,
  toDateKey,
} from "@/lib/date-utils";
import { getHighestPriority, getPriorityClass } from "@/lib/priority";
import { ProgressBar } from "./ProgressBar";

type CalendarTabViewProps = {
  tasks: TaskNode[];
  onSelectTask: (taskId: TaskId) => void;
  focusedDate: string | null;
  onFocusDate: (dueDate: string | null) => void;
  onAddTask: (dueDate: string, anchorTop?: number) => void;
};

const INITIAL_FORWARD_DAYS = 45;
const FORWARD_CHUNK = 30;

export function CalendarTabView({ tasks, onSelectTask, focusedDate, onFocusDate, onAddTask }: CalendarTabViewProps) {
  const { messages: text } = useLanguage();
  const todayKey = getTodayKey();

  const [endOffset, setEndOffset] = useState(INITIAL_FORWARD_DAYS);
  const [isOverdueOpen, setIsOverdueOpen] = useState(true);
  const [isMonthGridOpen, setIsMonthGridOpen] = useState(false);
  const [gridMonth, setGridMonth] = useState(() => new Date());
  const [visibleMonthLabel, setVisibleMonthLabel] = useState(() =>
    getMonthLabelFromKey(todayKey, text.common.locale),
  );
  const [pendingScrollDate, setPendingScrollDate] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const dayRefs = useRef(new Map<string, HTMLElement>());
  const scrollRafRef = useRef<number | null>(null);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskNode[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      map.set(task.dueDate, [...(map.get(task.dueDate) ?? []), task]);
    }
    for (const [date, dateTasks] of map) {
      map.set(
        date,
        dateTasks
          .slice()
          .sort((first, second) =>
            sortScheduleValues(first.dueDate, first.dueTime, second.dueDate, second.dueTime),
          ),
      );
    }
    return map;
  }, [tasks]);

  const overdueGroups = useMemo(() => {
    const map = new Map<string, TaskNode[]>();
    for (const task of tasks) {
      if (!task.dueDate || task.completed) continue;
      if (task.dueDate >= todayKey) continue;
      map.set(task.dueDate, [...(map.get(task.dueDate) ?? []), task]);
    }
    return Array.from(map, ([date, dateTasks]) => ({
      date,
      tasks: dateTasks
        .slice()
        .sort((first, second) =>
          sortScheduleValues(first.dueDate, first.dueTime, second.dueDate, second.dueTime),
        ),
    })).sort((first, second) => first.date.localeCompare(second.date));
  }, [tasks, todayKey]);

  const overdueCount = useMemo(
    () => overdueGroups.reduce((total, group) => total + group.tasks.length, 0),
    [overdueGroups],
  );

  const forwardDays = useMemo(() => {
    const base = fromDateKey(todayKey);
    return Array.from({ length: endOffset + 1 }, (_, offset) => {
      const date = new Date(base);
      date.setDate(date.getDate() + offset);
      return { date: toDateKey(date), offset };
    });
  }, [todayKey, endOffset]);

  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [date, dateTasks] of tasksByDate) {
      counts.set(date, dateTasks.length);
    }
    return counts;
  }, [tasksByDate]);

  const priorityByDate = useMemo(() => {
    return new Map(
      Array.from(tasksByDate, ([date, dateTasks]) => [date, getHighestPriority(dateTasks)]),
    );
  }, [tasksByDate]);

  const calendarDays = useMemo(() => buildCalendarDays(gridMonth), [gridMonth]);

  function updateVisibleMonth() {
    const container = scrollRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    let currentKey = forwardDays[0]?.date ?? todayKey;
    for (const day of forwardDays) {
      const element = dayRefs.current.get(day.date);
      if (!element) continue;
      if (element.getBoundingClientRect().top - containerTop <= 8) {
        currentKey = day.date;
      } else {
        break;
      }
    }
    const nextLabel = getMonthLabelFromKey(currentKey, text.common.locale);
    setVisibleMonthLabel((current) => (current === nextLabel ? current : nextLabel));
  }

  function handleScroll() {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      updateVisibleMonth();
    });
  }

  useEffect(() => {
    updateVisibleMonth();
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwardDays, text.common.locale]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEndOffset((current) => current + FORWARD_CHUNK);
        }
      },
      { root, rootMargin: "400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pendingScrollDate) return;
    const element = dayRefs.current.get(pendingScrollDate);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingScrollDate(null);
  }, [pendingScrollDate, forwardDays]);

  function moveGridMonth(offset: number) {
    setGridMonth((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  }

  function handleJumpToDate(date: string) {
    const offset = diffDaysFromKey(date, todayKey);
    if (offset < 0) return;
    setEndOffset((current) => Math.max(current, offset + 7));
    setIsMonthGridOpen(false);
    onFocusDate(date);
    setPendingScrollDate(date);
  }

  return (
    <section className="calendarTabView">
      <div className="calStickyHeader">
        <h2>{visibleMonthLabel}</h2>
        <button
          type="button"
          className={isMonthGridOpen ? "calMonthToggle isActive" : "calMonthToggle"}
          onClick={() => setIsMonthGridOpen((open) => !open)}
          aria-expanded={isMonthGridOpen}
        >
          <CalendarDays size={16} aria-hidden="true" />
          <span>{text.calendar.monthView}</span>
        </button>
      </div>

      {isMonthGridOpen ? (
        <div className="calMonthJump">
          <div className="calendarHeader">
            <button type="button" aria-label={text.common.previousMonth} onClick={() => moveGridMonth(-1)}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <h2>{getMonthLabel(gridMonth, text.common.locale)}</h2>
            <button type="button" aria-label={text.common.nextMonth} onClick={() => moveGridMonth(1)}>
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
              const isPast = day.date < todayKey;

              return (
                <button
                  className={[
                    "calendarDay calendarDayReadOnly",
                    day.isCurrentMonth ? "" : "isMuted",
                    day.isToday ? "isToday" : "",
                    taskCount > 0 ? "hasTasks" : "",
                    isPast ? "isPastDay" : "",
                  ].filter(Boolean).join(" ")}
                  key={day.date}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleJumpToDate(day.date)}
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
        </div>
      ) : null}

      {overdueCount > 0 ? (
        <section className="calOverdue">
          <button
            type="button"
            className="calOverdueHead"
            onClick={() => setIsOverdueOpen((open) => !open)}
            aria-expanded={isOverdueOpen}
          >
            <span className="calOverdueTitle">
              {text.calendar.overdue}
              <span className="calOverdueCount">{overdueCount}</span>
            </span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={isOverdueOpen ? "calChevron isOpen" : "calChevron"}
            />
          </button>
          {isOverdueOpen ? (
            <div className="calOverdueBody">
              {overdueGroups.map((group) => (
                <DayGroup
                  key={group.date}
                  dateKey={group.date}
                  tasks={group.tasks}
                  todayKey={todayKey}
                  locale={text.common.locale}
                  weekdays={text.common.weekdays}
                  todayLabel={text.common.today}
                  tomorrowLabel={text.common.tomorrow}
                  onSelectTask={onSelectTask}
                  isSelected={group.date === focusedDate}
                  onFocusDate={onFocusDate}
                  onAddTask={onAddTask}
                  addLabel={text.common.addTask}
                  isOverdue
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="calDayList" ref={scrollRef} onScroll={handleScroll}>
        {forwardDays.map((day) => (
          <DayGroup
            key={day.date}
            dateKey={day.date}
            tasks={tasksByDate.get(day.date) ?? []}
            todayKey={todayKey}
            locale={text.common.locale}
            weekdays={text.common.weekdays}
            todayLabel={text.common.today}
            tomorrowLabel={text.common.tomorrow}
            onSelectTask={onSelectTask}
            isSelected={day.date === focusedDate}
            onFocusDate={onFocusDate}
            onAddTask={onAddTask}
            addLabel={text.common.addTask}
            registerRef={(element) => {
              if (element) {
                dayRefs.current.set(day.date, element);
              } else {
                dayRefs.current.delete(day.date);
              }
            }}
          />
        ))}
        <div ref={sentinelRef} className="calSentinel" aria-hidden="true" />
      </div>
    </section>
  );
}

type DayGroupProps = {
  dateKey: string;
  tasks: TaskNode[];
  todayKey: string;
  locale: string;
  weekdays: string[];
  todayLabel: string;
  tomorrowLabel: string;
  onSelectTask: (taskId: TaskId) => void;
  isSelected: boolean;
  onFocusDate: (dueDate: string | null) => void;
  onAddTask: (dueDate: string, anchorTop?: number) => void;
  addLabel: string;
  isOverdue?: boolean;
  registerRef?: (element: HTMLElement | null) => void;
};

function DayGroup({
  dateKey,
  tasks,
  todayKey,
  locale,
  weekdays,
  todayLabel,
  tomorrowLabel,
  onSelectTask,
  isSelected,
  onFocusDate,
  onAddTask,
  addLabel,
  isOverdue = false,
  registerRef,
}: DayGroupProps) {
  const offset = diffDaysFromKey(dateKey, todayKey);
  const weekday = weekdays[getWeekdayIndexFromKey(dateKey)] ?? "";
  const isToday = offset === 0;
  const isTomorrow = offset === 1;
  const dateLabel = isToday ? todayLabel : isTomorrow ? tomorrowLabel : getDisplayDate(dateKey, locale);

  const groupClassName = [
    "calDayGroup",
    isToday ? "isToday" : "",
    isOverdue ? "isOverdue" : "",
    isSelected ? "isSelected" : "",
    tasks.length === 0 ? "isEmpty" : "",
  ].filter(Boolean).join(" ");

  return (
    <section className={groupClassName} ref={registerRef}>
      <button
        type="button"
        className="calDayGroupHead"
        onClick={() => onFocusDate(isSelected ? null : dateKey)}
        aria-pressed={isSelected}
      >
        <span className="calDayLabel">
          <span className="calDayDate">{dateLabel}</span>
          <span className="calDayWeekday">{weekday}</span>
        </span>
        <span className={offsetClassName(offset)}>{formatOffset(offset)}</span>
      </button>
      {tasks.length > 0 ? (
        <div className="calDayTasks">
          {tasks.map((task) => (
            <button
              className={task.children.length > 0 ? "agendaRow hasProgress" : "agendaRow"}
              key={task.id}
              type="button"
              onClick={() => onSelectTask(task.id)}
            >
              {task.dueTime ? (
                <span className="agendaTime">{task.dueTime}</span>
              ) : (
                <span className="agendaTime" aria-hidden="true" />
              )}
              <span className={task.completed ? "agendaTitle isCompleted" : "agendaTitle"}>
                <span
                  className={`priorityDot taskPriorityDot ${getPriorityClass(task.priority)}`}
                  aria-hidden="true"
                />
                {task.title}
              </span>
              {task.children.length > 0 ? <ProgressBar value={task.progress} /> : null}
            </button>
          ))}
        </div>
      ) : null}
      {isSelected ? (
        <button
          type="button"
          className="calDayAddInline"
          aria-label={addLabel}
          onClick={(event) => onAddTask(dateKey, event.currentTarget.getBoundingClientRect().bottom)}
        >
          <Plus size={15} aria-hidden="true" />
          <span>{addLabel}</span>
        </button>
      ) : null}
    </section>
  );
}

function formatOffset(offset: number): string {
  if (offset === 0) return "±0";
  return offset > 0 ? `+${offset}` : `${offset}`;
}

function offsetClassName(offset: number): string {
  if (offset === 0) return "calDayOffset isToday";
  if (offset < 0) return "calDayOffset isPast";
  return "calDayOffset";
}
