"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import type { TaskGroup, TaskGroupId, TaskId, TaskNode } from "@/types/task";
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
import { primeKeyboard } from "@/lib/ios-keyboard";
import { ProgressBar } from "./ProgressBar";
import { ComposeBar } from "./ComposeBar";
import { ComposeGhostRow } from "./ComposeGhostRow";
import { TaskLocationPicker } from "./TaskLocationPicker";
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { ScheduleEditorSheet } from "./ScheduleEditorSheet";
import type { QuickAddDraft } from "./QuickAddSheet";

const EMPTY_COMPOSE_DRAFT: QuickAddDraft = {
  title: "",
  dueDate: null,
  dueTime: null,
  priority: "none",
};

type CalendarTabViewProps = {
  tasks: TaskNode[];
  onSelectTask: (taskId: TaskId) => void;
  focusedDate: string | null;
  onFocusDate: (dueDate: string | null) => void;
  onCreateTask: (draft: QuickAddDraft) => void;
  // Reports whether inline compose is active, so the parent can disable the app
  // chrome (header, bottom tabs) while composing.
  onComposingChange?: (composing: boolean) => void;
  onMoveTask: (taskId: TaskId, dueDate: string) => void;
  onDeleteTask: (taskId: TaskId) => void;
  // Groups + the current group, for the compose group selector (internal only:
  // picking a group sets the new task's group; the calendar view doesn't switch).
  groups: TaskGroup[];
  activeGroupId: TaskGroupId;
  highlightedTaskId?: TaskId | null;
};

const INITIAL_FORWARD_DAYS = 45;
const FORWARD_CHUNK = 30;
const DAY_DROPPABLE_PREFIX = "cal-day:";

// Timed tasks first (by time), then untimed tasks in creation order so a task
// just composed lands at the BOTTOM of its day group — right above the compose
// sheet — instead of inheriting the inbox's newest-first order.
function compareDayTasks(first: TaskNode, second: TaskNode): number {
  const scheduleCompare = sortScheduleValues(
    first.dueDate,
    first.dueTime,
    second.dueDate,
    second.dueTime,
  );
  if (scheduleCompare !== 0) return scheduleCompare;
  return first.createdAt.localeCompare(second.createdAt);
}

export function CalendarTabView({
  tasks,
  onSelectTask,
  focusedDate,
  onFocusDate,
  onCreateTask,
  onComposingChange,
  onMoveTask,
  onDeleteTask,
  groups,
  activeGroupId,
  highlightedTaskId = null,
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
  // Inline compose: which day is being composed, plus the shared draft bound to
  // the ghost row (in that day) and the slim bar (date/priority) above the keyboard.
  const [composeDate, setComposeDate] = useState<string | null>(null);
  const [composeDraft, setComposeDraft] = useState<QuickAddDraft>(EMPTY_COMPOSE_DRAFT);
  const [composeScheduleOpen, setComposeScheduleOpen] = useState(false);
  const [composePriorityOpen, setComposePriorityOpen] = useState(false);
  const [composeLocationPickerOpen, setComposeLocationPickerOpen] = useState(false);
  const composeInputRef = useRef<HTMLDivElement | null>(null);
  const suppressComposeCommitRef = useRef(false);
  const finishingComposeRef = useRef(false);

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
      map.set(date, dateTasks.slice().sort(compareDayTasks));
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
      tasks: dateTasks.slice().sort(compareDayTasks),
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

  // Keep the parent's chrome-disable flag in sync with local compose state.
  useEffect(() => {
    onComposingChange?.(composeDate !== null);
    return () => onComposingChange?.(false);
  }, [composeDate, onComposingChange]);

  // Compose mode: constrain the list to the area above the keyboard/bar and pin
  // the ghost row (the day's tail, where the task lands) just above the slim bar.
  useEffect(() => {
    const list = scrollRef.current;
    if (!list) return;

    if (!composeDate) {
      list.style.maxHeight = "";
      list.style.scrollPaddingBottom = "";
      return;
    }

    function align(behavior: ScrollBehavior) {
      const listEl = scrollRef.current;
      const dayEl = composeDate ? dayRefs.current.get(composeDate) : null;
      if (!listEl || !dayEl) return;
      // Bottom of the VISIBLE area in layout-viewport (client) coordinates. On
      // Android Chrome window.innerHeight already shrinks for the keyboard, so
      // this equals innerHeight. On iOS Safari innerHeight stays full-screen
      // while the keyboard occupies the bottom, so we must derive the visible
      // bottom from the visual viewport — the same coordinate space the bar is
      // pinned to (--kb-view-top/height). Mixing the two makes the pin land below
      // the bar / wobble on iOS.
      const vv = window.visualViewport;
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const listTop = listEl.getBoundingClientRect().top;
      const bar = document.querySelector(".composeBar .composeBarInner");
      const occluded = bar
        ? visibleBottom - bar.getBoundingClientRect().top + 8
        : 160;
      // Extend the scroll area down to the bar's top edge so the ghost can pin just above it.
      listEl.style.maxHeight = `${Math.max(0, visibleBottom - listTop)}px`;
      listEl.style.scrollPaddingBottom = `${Math.round(occluded)}px`;
      const ghostEl = listEl.querySelector<HTMLElement>(".composeGhostRow");
      (ghostEl ?? dayEl).scrollIntoView({ block: "end", behavior });
    }

    // Focus the ghost input (keyboard already primed) then pin. The keyboard /
    // visual viewport settles over ~300ms on iOS, firing several resize events at
    // intermediate heights; re-dock instantly ("auto") on each so the final settle
    // lands exactly, without stacking interruptible smooth scrolls.
    const raf = window.requestAnimationFrame(() => {
      composeInputRef.current?.focus({ preventScroll: true });
      align("smooth");
    });
    const alignInstant = () => align("auto");
    window.visualViewport?.addEventListener("resize", alignInstant);
    return () => {
      window.cancelAnimationFrame(raf);
      window.visualViewport?.removeEventListener("resize", alignInstant);
    };
  }, [composeDate, tasksByDate]);

  function startCompose(date: string) {
    // Raise the keyboard synchronously inside the tap (iOS); the align effect
    // focuses the ghost input once it mounts and pins it above the bar.
    primeKeyboard();
    finishingComposeRef.current = false;
    suppressComposeCommitRef.current = false;
    setComposeDraft({
      ...EMPTY_COMPOSE_DRAFT,
      dueDate: date,
      groupId: activeGroupId,
      parentTaskId: null,
    });
    onFocusDate(date);
    setComposeDate(date);
  }

  function updateComposeTitle(title: string) {
    setComposeDraft((current) => ({ ...current, title }));
  }

  // Enter: save the current task on this day and keep composing (fresh ghost row).
  function commitComposeAndContinue() {
    if (!composeDate || composeDraft.title.trim().length === 0) return;
    onCreateTask({ ...composeDraft, title: composeDraft.title.trim() });
    // Keep the chosen group/day for the next entry.
    setComposeDraft({
      ...EMPTY_COMPOSE_DRAFT,
      dueDate: composeDate,
      groupId: composeDraft.groupId,
      parentTaskId: composeDraft.parentTaskId,
    });
    window.requestAnimationFrame(() => composeInputRef.current?.focus({ preventScroll: true }));
  }

  // Blur (keyboard dismissed): save if non-empty else discard, then close.
  // Skipped while a date/priority editor is open. Guarded against double commit.
  function finishCompose() {
    if (suppressComposeCommitRef.current) return;
    if (finishingComposeRef.current) return;
    finishingComposeRef.current = true;
    const draft = composeDraft;
    setComposeDate(null);
    if (draft.title.trim().length > 0) {
      onCreateTask({ ...draft, title: draft.title.trim() });
    }
  }

  function openComposeSchedule() {
    suppressComposeCommitRef.current = true;
    setComposeScheduleOpen(true);
  }

  function openComposePriority() {
    suppressComposeCommitRef.current = true;
    setComposePriorityOpen(true);
  }

  function openComposeGroup() {
    suppressComposeCommitRef.current = true;
    setComposeLocationPickerOpen(true);
  }

  function closeComposeEditors() {
    setComposeScheduleOpen(false);
    setComposePriorityOpen(false);
    setComposeLocationPickerOpen(false);
    suppressComposeCommitRef.current = false;
    composeInputRef.current?.focus({ preventScroll: true });
    window.requestAnimationFrame(() => composeInputRef.current?.focus({ preventScroll: true }));
  }

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

  const composeGhost: ReactNode = composeDate ? (
    <ComposeGhostRow
      draft={composeDraft}
      inputRef={composeInputRef}
      onChangeTitle={updateComposeTitle}
      onSubmit={commitComposeAndContinue}
      onFinish={finishCompose}
      locationLabel={getComposeLocationLabel(groups, tasks, composeDraft, activeGroupId)}
    />
  ) : null;

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
    <section className={composeDate ? "calendarTabView isComposing" : "calendarTabView"}>
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
                  onAddTask={startCompose}
                  addLabel={text.common.addTask}
                  composeSlot={group.date === composeDate ? composeGhost : null}
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
            onAddTask={startCompose}
            addLabel={text.common.addTask}
            composeSlot={day.date === composeDate ? composeGhost : null}
            highlightedTaskId={highlightedTaskId}
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
    {/* Portal to <body> so the fixed bar is anchored to the viewport, not to the
        scroll container it would otherwise live in — otherwise opening/closing
        the group picker (which toggles body overflow) nudges the bar down. */}
    {composeDate
      ? createPortal(
          <ComposeBar
            draft={composeDraft}
            groupLabel={getComposeLocationLabel(groups, tasks, composeDraft, activeGroupId)}
            onOpenGroup={openComposeGroup}
            onOpenSchedule={openComposeSchedule}
            onOpenPriority={openComposePriority}
            onSuppressCommit={() => {
              suppressComposeCommitRef.current = true;
            }}
          />,
          document.body,
        )
      : null}
    {composeDate && composeLocationPickerOpen ? (
      <TaskLocationPicker
        groups={groups}
        tasks={tasks}
        value={{
          groupId: composeDraft.groupId ?? activeGroupId,
          parentTaskId: composeDraft.parentTaskId ?? null,
        }}
        onChange={({ groupId, parentTaskId }) => {
          // Calendar remains date-oriented: only the destination changes. Keep
          // the picker open so a task can be followed through multiple levels.
          setComposeDraft((current) => ({ ...current, groupId, parentTaskId }));
        }}
        onDismiss={closeComposeEditors}
      />
    ) : null}
    {composeDate && composeScheduleOpen ? (
      <ScheduleEditorSheet
        dueDate={composeDraft.dueDate}
        dueTime={composeDraft.dueTime}
        onChange={(dueDate, dueTime) =>
          setComposeDraft((current) => ({ ...current, dueDate, dueTime }))
        }
        onDismiss={closeComposeEditors}
      />
    ) : null}
    {composeDate && composePriorityOpen ? (
      <PriorityEditorSheet
        value={composeDraft.priority}
        onChange={(priority) => setComposeDraft((current) => ({ ...current, priority }))}
        onDismiss={closeComposeEditors}
      />
    ) : null}
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
  highlightedTaskId?: TaskId | null;
  // The compose ghost row, rendered at this day's tail while composing here.
  composeSlot?: ReactNode;
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
  highlightedTaskId = null,
  composeSlot = null,
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
            <CalendarTaskRow
              key={task.id}
              task={task}
              onSelectTask={onSelectTask}
              isHighlighted={task.id === highlightedTaskId}
            />
          ))}
        </div>
      ) : null}
      {composeSlot}
      {isComposing ? null : (
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
      )}
    </section>
  );
}

type CalendarTaskRowProps = {
  task: TaskNode;
  onSelectTask: (taskId: TaskId) => void;
  isHighlighted?: boolean;
};

function CalendarTaskRow({ task, onSelectTask, isHighlighted = false }: CalendarTaskRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "calendar-task", dueDate: task.dueDate },
  });

  const className = [
    task.children.length > 0 ? "agendaRow hasProgress" : "agendaRow",
    isDragging ? "isDragging" : "",
    isHighlighted ? "isNewlyAdded" : "",
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

function getComposeLocationLabel(
  groups: TaskGroup[],
  tasks: TaskNode[],
  draft: QuickAddDraft,
  activeGroupId: TaskGroupId,
): string {
  const group = groups.find((candidate) => candidate.id === (draft.groupId ?? activeGroupId));
  if (!group) return "";
  if (!draft.parentTaskId) return group.name;

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const path: string[] = [];
  let current = tasksById.get(draft.parentTaskId);
  while (current) {
    path.unshift(current.title);
    current = current.parentId ? tasksById.get(current.parentId) : undefined;
  }

  return [group.name, ...path].join(" > ");
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
