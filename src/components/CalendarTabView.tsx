"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  closestCenter,
  pointerWithin,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TaskId, TaskNode } from "@/types/task";
import { TrashDropZone, TRASH_DROPPABLE_ID } from "./TrashDropZone";
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
  onAddTask: (dueDate: string) => void;
  onMoveTask: (taskId: TaskId, dueDate: string) => void;
  onDeleteTask: (taskId: TaskId) => void;
  composeDate: string | null;
};

const INITIAL_FORWARD_DAYS = 45;
const FORWARD_CHUNK = 30;
const DAY_DROPPABLE_PREFIX = "cal-day:";

export function CalendarTabView({
  tasks,
  onSelectTask,
  focusedDate,
  onFocusDate,
  onAddTask,
  onMoveTask,
  onDeleteTask,
  composeDate,
}: CalendarTabViewProps) {
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
  const [activeDragTaskId, setActiveDragTaskId] = useState<TaskId | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  // Prefer the trash target when the pointer is over it; otherwise pick the
  // nearest day droppable (mirrors the inbox behaviour).
  const collisionDetection = useCallback<typeof closestCenter>((args) => {
    const pointerCollisions = pointerWithin(args);
    const trashCollision = pointerCollisions.find((c) => c.id === TRASH_DROPPABLE_ID);
    if (trashCollision) return [trashCollision];

    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.id !== TRASH_DROPPABLE_ID,
      ),
    });
  }, []);

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

  // Compose mode: freeze the list and pin the composed day's tail just above the sheet.
  useEffect(() => {
    const list = scrollRef.current;
    if (!list) return;

    if (!composeDate) {
      list.style.maxHeight = "";
      list.style.scrollPaddingBottom = "";
      return;
    }

    function align() {
      const listEl = scrollRef.current;
      const dayEl = composeDate ? dayRefs.current.get(composeDate) : null;
      if (!listEl || !dayEl) return;
      const listTop = listEl.getBoundingClientRect().top;
      const sheet = document.querySelector(".quickAddSheet");
      const occluded = sheet
        ? window.innerHeight - sheet.getBoundingClientRect().top + 8
        : 220;
      // Extend the scroll area down to the sheet's top edge so the day can pin just above it.
      listEl.style.maxHeight = `${Math.max(0, window.innerHeight - listTop)}px`;
      listEl.style.scrollPaddingBottom = `${Math.round(occluded)}px`;
      dayEl.scrollIntoView({ block: "end", behavior: "smooth" });
    }

    const raf = window.requestAnimationFrame(align);
    window.visualViewport?.addEventListener("resize", align);
    return () => {
      window.cancelAnimationFrame(raf);
      window.visualViewport?.removeEventListener("resize", align);
    };
  }, [composeDate, tasksByDate]);

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

  const activeDragTask = activeDragTaskId
    ? tasks.find((task) => task.id === activeDragTaskId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragTaskId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    setIsOverTrash(event.over?.id === TRASH_DROPPABLE_ID);
  }

  function handleDragCancel() {
    setActiveDragTaskId(null);
    setIsOverTrash(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    setActiveDragTaskId(null);
    setIsOverTrash(false);

    const draggedTask = tasks.find((task) => task.id === activeId);
    if (!draggedTask) return;

    if (overId === TRASH_DROPPABLE_ID) {
      if (draggedTask.children.length === 0 || window.confirm(text.taskDetail.deleteWithSubtasks)) {
        onDeleteTask(activeId);
      }
      return;
    }

    if (!overId || !overId.startsWith(DAY_DROPPABLE_PREFIX)) return;
    const nextDate = overId.slice(DAY_DROPPABLE_PREFIX.length);
    if (nextDate === draggedTask.dueDate) return;
    onMoveTask(activeId, nextDate);
  }

  return (
    <DndContext
      collisionDetection={collisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
                  isComposing={group.date === composeDate}
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

      <div
        className={composeDate ? "calDayList isCompose" : "calDayList"}
        ref={scrollRef}
        onScroll={handleScroll}
      >
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
            isComposing={day.date === composeDate}
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
    <TrashDropZone active={activeDragTaskId !== null} />
    <DragOverlay modifiers={[snapCenterToCursor]}>
      {activeDragTask ? (
        <div className={isOverTrash ? "dragOverlayTask isOverTrash" : "dragOverlayTask"}>
          <span
            className={`priorityDot taskPriorityDot ${getPriorityClass(activeDragTask.priority)}`}
            aria-hidden="true"
          />
          <span>{activeDragTask.title}</span>
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
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
  isComposing: boolean;
  onFocusDate: (dueDate: string | null) => void;
  onAddTask: (dueDate: string) => void;
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
  isComposing,
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

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `${DAY_DROPPABLE_PREFIX}${dateKey}`,
    data: { dateKey },
  });

  const setGroupRef = (element: HTMLElement | null) => {
    setDroppableRef(element);
    registerRef?.(element);
  };

  const groupClassName = [
    "calDayGroup",
    isToday ? "isToday" : "",
    isOverdue ? "isOverdue" : "",
    isSelected ? "isSelected" : "",
    isComposing ? "isComposing" : "",
    tasks.length === 0 ? "isEmpty" : "",
    isOver ? "isDropTarget" : "",
  ].filter(Boolean).join(" ");

  return (
    <section className={groupClassName} ref={setGroupRef}>
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
            <CalendarTaskRow key={task.id} task={task} onSelectTask={onSelectTask} />
          ))}
        </div>
      ) : null}
      <div className="calDayAddSlot" aria-hidden={!isSelected}>
        <button
          type="button"
          className="calDayAddInline"
          aria-label={addLabel}
          tabIndex={isSelected ? 0 : -1}
          onClick={() => onAddTask(dateKey)}
        >
          <Plus size={15} aria-hidden="true" />
          <span>{addLabel}</span>
        </button>
      </div>
    </section>
  );
}

type CalendarTaskRowProps = {
  task: TaskNode;
  onSelectTask: (taskId: TaskId) => void;
};

function CalendarTaskRow({ task, onSelectTask }: CalendarTaskRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "calendar-task", dueDate: task.dueDate },
  });

  const className = [
    task.children.length > 0 ? "agendaRow hasProgress" : "agendaRow",
    isDragging ? "isDragging" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      ref={setNodeRef}
      className={className}
      type="button"
      onClick={() => onSelectTask(task.id)}
      {...attributes}
      {...listeners}
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
