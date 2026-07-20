"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeft, CalendarClock, ChevronRight, Flag, MapPin, Plus } from "lucide-react";
import { createPortal } from "react-dom";
import {
  closestCenter,
  pointerWithin,
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import type { TaskId, TaskNode } from "@/types/task";
import { getScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import { EditableTitle } from "./EditableTitle";
import { ProgressBar } from "./ProgressBar";
import { ComposeGhostRow } from "./ComposeGhostRow";
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { TrashDropZone, TRASH_DROPPABLE_ID } from "./TrashDropZone";
import { TrashIcon } from "./TrashIcon";
import type { QuickAddDraft } from "./QuickAddSheet";

type TaskDetailViewProps = {
  task: TaskNode;
  path: TaskNode[];
  groupName: string;
  onSelectTask: (taskId: TaskId) => void;
  onToggleComplete: (taskId: TaskId) => void;
  onRenameTask: (taskId: TaskId, title: string) => void;
  onUpdateDescription: (taskId: TaskId, description: string) => void;
  onUpdatePriority: (taskId: TaskId, priority: TaskNode["priority"]) => void;
  onDeleteTask: (taskId: TaskId) => void;
  onOpenSchedule: (taskId: TaskId) => void;
  // Close the whole detail sheet, back to the list underneath.
  onClose: () => void;
  autoEditTaskId: TaskId | null;
  onAutoEditConsumed: () => void;
  onReorderChild: (activeId: TaskId, overId: TaskId) => void;
  // The app-level compose session, projected onto this view: non-null while the
  // session targets this task, in which case the ghost row renders at the tail
  // of the subtask list. This view never owns a draft or any compose sheets —
  // the compose bar and location/date/priority panels live in TaskApp.
  composeDraft: QuickAddDraft | null;
  composeInputRef: RefObject<HTMLDivElement | null>;
  composeLocationLabel?: string;
  onChangeComposeTitle: (title: string) => void;
  // Enter: save the current title and keep composing (fresh ghost row).
  onCommitCompose: () => void;
  // Blur (keyboard dismissed): save if non-empty, otherwise discard, then close.
  onFinishCompose: () => void;
  // "Add subtask": start a session targeting this task.
  onOpenComposer: () => void;
};

export function TaskDetailView({
  task,
  path,
  groupName,
  onSelectTask,
  onToggleComplete,
  onRenameTask,
  onUpdateDescription,
  onUpdatePriority,
  onDeleteTask,
  onOpenSchedule,
  onClose,
  autoEditTaskId,
  onAutoEditConsumed,
  onReorderChild,
  composeDraft,
  composeInputRef,
  composeLocationLabel,
  onChangeComposeTitle,
  onCommitCompose,
  onFinishCompose,
  onOpenComposer,
}: TaskDetailViewProps) {
  const { messages: text } = useLanguage();
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [activeDragTaskId, setActiveDragTaskId] = useState<TaskId | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const composerOpen = composeDraft !== null;
  // Press-and-hold to start a drag (same feel as inbox/calendar): a quick tap
  // still toggles/opens the subtask, a hold drags the whole row to reorder or
  // onto the trash to delete.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  // Prefer the trash target when the pointer is over it; otherwise reorder among
  // the subtask rows (mirrors the calendar behaviour).
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
  const translatedPriorityLabels = useMemo(() => getTranslatedPriorityLabels(text), [text]);
  const { labels } = usePriorityLabels(translatedPriorityLabels);

  const viewRef = useRef<HTMLElement>(null);
  const detailPathRef = useRef<HTMLDivElement | null>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Same rule as the compose bar strip and the location picker header: when the
  // path overflows, the tail — where you are — is the part that stays visible.
  useEffect(() => {
    const pathElement = detailPathRef.current;
    if (!pathElement) return;
    pathElement.scrollTo({ left: pathElement.scrollWidth });
  }, [task.id]);

  // Keep the note as a continuous piece of text instead of a fixed-height
  // field: its sheet grows naturally as the user writes.
  useEffect(() => {
    const input = descriptionInputRef.current;
    if (!input) return;

    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [task.id, task.description]);

  // While composing, pin the ghost row (the tail of the subtask list, where the
  // new subtask lands) just above the slim compose bar. The spacer below is sized
  // to the bar's occluded height so there's always room to scroll the tail up to
  // it. On open (and keyboard resize) we jump instantly ("auto") so it appears
  // already docked, with no visible scroll.
  const alignSubtaskTail = (behavior: ScrollBehavior) => {
    const view = viewRef.current;
    const sheet = view?.closest(".draggableSheet");
    if (!(sheet instanceof HTMLElement)) return;
    const ghost = view?.querySelector<HTMLElement>(".composeGhostRow");
    const spacer = view?.querySelector<HTMLElement>(".detailComposerSpacer");

    // Bottom of the VISIBLE area in layout-viewport (client) coordinates. The bar
    // and this sheet are both pinned to the visual viewport (--kb-view-top/height),
    // so occlusion must be measured in that same space. On Android Chrome
    // innerHeight already shrinks for the keyboard; on iOS Safari it stays
    // full-screen, so using it would inflate occluded by the keyboard height.
    const vv = window.visualViewport;
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const bar = document.querySelector(".composeBar .composeBarInner");
    const barTop = bar ? bar.getBoundingClientRect().top : visibleBottom - 140;
    const occluded = visibleBottom - barTop + 8;
    // The spacer gives the sheet enough scrollable room below the ghost so it can
    // be scrolled clear of the bar.
    if (spacer) spacer.style.height = `${Math.round(occluded)}px`;

    const target = ghost ?? view?.querySelector<HTMLElement>(".subtaskList");
    if (!target) {
      sheet.scrollTop = sheet.scrollHeight;
      return;
    }
    // Scroll so the target's bottom sits just above the bar. We set scrollTop
    // directly rather than relying on scrollIntoView + scroll-padding-bottom,
    // which iOS Safari honors unreliably (leaving the ghost behind the bar).
    const delta = target.getBoundingClientRect().bottom - (barTop - 8);
    const nextTop = Math.max(0, sheet.scrollTop + delta);
    if (behavior === "smooth") {
      sheet.scrollTo({ top: nextTop, behavior: "smooth" });
    } else {
      sheet.scrollTop = nextTop;
    }
  };

  // On open + keyboard resize: focus the ghost input and dock it above the bar.
  useEffect(() => {
    if (!composerOpen) return;
    const sheet = viewRef.current?.closest(".draggableSheet");
    if (!(sheet instanceof HTMLElement)) return;

    const alignInstant = () => alignSubtaskTail("auto");

    // Right after the composer opens, everything is still moving: the keyboard
    // is animating up, the detail sheet is sliding to its full-height rest and
    // the bar is re-pinning to the shrinking visual viewport. Aligning once at
    // the first opportunity measures mid-animation and strands the ghost row
    // behind the keyboard. So re-dock every frame until the dust has settled
    // (~700ms comfortably covers the iOS keyboard + sheet transitions), and
    // focus the ghost input (keyboard already up transfers focus; re-focusing
    // the focused element is a no-op).
    let frame = 0;
    const openedAt = performance.now();
    const tick = () => {
      composeInputRef.current?.focus({ preventScroll: true });
      alignInstant();
      if (performance.now() - openedAt > 700) return;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    window.visualViewport?.addEventListener("resize", alignInstant);

    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", alignInstant);
      sheet.style.scrollPaddingBottom = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerOpen, task.id]);

  // After each add (or removal), smoothly re-dock the new tail above the sheet.
  useEffect(() => {
    if (!composerOpen) return;
    const timer = window.setTimeout(() => alignSubtaskTail("smooth"), 40);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.children.length, composerOpen]);

  function handleDelete() {
    if (task.children.length === 0) {
      onDeleteTask(task.id);
      return;
    }

    if (window.confirm(text.taskDetail.deleteWithSubtasks)) {
      onDeleteTask(task.id);
    }
  }

  function handleSubtaskDragStart(event: DragStartEvent) {
    setActiveDragTaskId(String(event.active.id));
  }

  function handleSubtaskDragOver(event: DragOverEvent) {
    setIsOverTrash(event.over?.id === TRASH_DROPPABLE_ID);
  }

  function handleSubtaskDragCancel() {
    setActiveDragTaskId(null);
    setIsOverTrash(false);
  }

  function handleSubtaskDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    setActiveDragTaskId(null);
    setIsOverTrash(false);

    const dragged = task.children.find((child) => child.id === activeId);
    if (!dragged) return;

    if (overId === TRASH_DROPPABLE_ID) {
      if (dragged.children.length === 0 || window.confirm(text.taskDetail.deleteWithSubtasks)) {
        onDeleteTask(activeId);
      }
      return;
    }

    if (!overId || overId === activeId) return;
    onReorderChild(activeId, overId);
  }

  const activeDragTask = activeDragTaskId
    ? task.children.find((child) => child.id === activeDragTaskId) ?? null
    : null;

  return (
    <section ref={viewRef} className={composerOpen ? "detailView isComposing" : "detailView"}>
      {/* Same header band as the compose bar strip / location picker, so the
          "where am I" UI reads as one thing across all three surfaces. The
          group and the current task are labels; ancestors in between navigate. */}
      <div className="taskLocationHeader detailPath" inert={composerOpen}>
        {/* One level up: the parent task's detail, or — from a root task —
            close the sheet. Held down repeatedly it always leads to the list. */}
        <button
          type="button"
          className="detailBackButton"
          aria-label={text.common.back}
          onClick={() => {
            const parentNode = path.length > 1 ? path[path.length - 2] : null;
            if (parentNode) onSelectTask(parentNode.id);
            else onClose();
          }}
        >
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
        <MapPin size={15} aria-hidden="true" />
        <div ref={detailPathRef} className="taskLocationPath" aria-label={text.taskDetail.path}>
          {/* The group is the path's root: tapping it leaves the tree entirely,
              back to the inbox list. */}
          <button type="button" className="taskLocationCrumb" onClick={onClose}>
            {groupName}
          </button>
          {path.slice(0, -1).map((node) => (
            <span className="taskLocationCrumbWrap" key={node.id}>
              <ChevronRight size={14} aria-hidden="true" />
              <button
                type="button"
                className="taskLocationCrumb"
                onClick={() => onSelectTask(node.id)}
              >
                {node.title}
              </button>
            </span>
          ))}
          <span className="taskLocationCrumbWrap">
            <ChevronRight size={14} aria-hidden="true" />
            <span className="taskLocationCrumb isCurrent">{task.title}</span>
          </span>
        </div>
      </div>

      {/* While composing, the sections around the ghost input are "look but
          don't touch" — `inert` makes that formal, removing their controls
          (checkboxes, title inputs, the note textarea) from focus and from
          iOS's keyboard field navigation, which otherwise pins its
          prev/next/done assistant bar above the keyboard. */}
      <div
        className={task.children.length > 0 ? "detailHeader hasProgress" : "detailHeader"}
        inert={composerOpen}
      >
        <input
          className={`check ${getPriorityClass(task.priority)}`}
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggleComplete(task.id)}
          aria-label={text.taskDetail.complete.replace("{title}", task.title)}
        />
        <EditableTitle
          value={task.title}
          className={task.completed ? "detailTitle titleButton isCompleted" : "detailTitle titleButton"}
          inputClassName="detailTitle detailTitleInput"
          taskId={task.id}
          autoEditTaskId={autoEditTaskId}
          editOnClick
          onAutoEditConsumed={onAutoEditConsumed}
          onSave={(title) => onRenameTask(task.id, title)}
        />
        {task.children.length > 0 ? <ProgressBar value={task.progress} /> : null}
      </div>

      <div className="detailMeta" aria-label="Task settings" inert={composerOpen}>
        <button
          className={task.dueDate ? "detailMetaAction" : "detailMetaAction isEmpty"}
          type="button"
          onClick={() => onOpenSchedule(task.id)}
        >
          <CalendarClock size={16} aria-hidden="true" />
          <span>{getScheduleLabel(task.dueDate, task.dueTime, {
            locale: text.common.locale,
            noDateLabel: text.common.noDate,
          })}</span>
        </button>
        <button
          className="detailMetaAction"
          type="button"
          onClick={() => setIsPriorityOpen(true)}
        >
          <Flag size={16} aria-hidden="true" />
          <span className="priorityValue">
            <span className={`priorityDot ${getPriorityClass(task.priority)}`} aria-hidden="true" />
            {getPriorityLabel(task.priority, labels)}
          </span>
        </button>
      </div>

      <section className="subtasksSection">
        <div className="subtasksHeader">
          <h3>{text.taskDetail.subtasks}</h3>
          <span>{task.children.length}</span>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={handleSubtaskDragStart}
          onDragOver={handleSubtaskDragOver}
          onDragEnd={handleSubtaskDragEnd}
          onDragCancel={handleSubtaskDragCancel}
        >
          <SortableContext
            items={task.children.map((child) => child.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="subtaskList" inert={composerOpen}>
              {task.children.map((child) => (
                <SortableSubtaskRow
                  key={child.id}
                  child={child}
                  autoEditTaskId={autoEditTaskId}
                  onAutoEditConsumed={onAutoEditConsumed}
                  onSelectTask={onSelectTask}
                  onToggleComplete={onToggleComplete}
                  onRenameTask={onRenameTask}
                  completeLabel={text.taskDetail.complete}
                  disabled={composerOpen}
                />
              ))}
            </div>
          </SortableContext>
          {composeDraft ? (
            <ComposeGhostRow
              draft={composeDraft}
              inputRef={composeInputRef}
              onChangeTitle={onChangeComposeTitle}
              onSubmit={onCommitCompose}
              onFinish={onFinishCompose}
              locationLabel={composeLocationLabel}
            />
          ) : null}
          <TrashDropZone active={activeDragTaskId !== null} compact />
          {/* Portal the overlay to <body> so its position:fixed is relative to
              the viewport, not the transformed detail sheet (a transformed
              ancestor becomes the containing block for fixed descendants, which
              otherwise offsets the drag preview from the pointer). */}
          {createPortal(
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
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
        {!composerOpen ? (
          <button
            className="subtaskAddButton"
            type="button"
            // startCompose primes the iOS keyboard synchronously inside this tap.
            onClick={onOpenComposer}
          >
            <Plus size={18} aria-hidden="true" />
            {text.taskDetail.addSubtask}
          </button>
        ) : null}
      </section>

      <section className="detailNote" aria-label={text.taskDetail.description} inert={composerOpen}>
        <textarea
          ref={descriptionInputRef}
          id={`description-${task.id}`}
          className="descriptionInput"
          value={task.description}
          placeholder={text.taskDetail.description}
          rows={1}
          onChange={(event) => onUpdateDescription(task.id, event.target.value)}
        />
      </section>

      <button className="detailDeleteButton" type="button" onClick={handleDelete} inert={composerOpen}>
        <TrashIcon />
        {text.taskDetail.deleteTask}
      </button>
      {/* The compose bar itself is rendered by TaskApp for the whole session;
          this spacer only reserves scroll room for it inside the sheet. */}
      {composerOpen ? <div className="detailComposerSpacer" aria-hidden="true" /> : null}
      {isPriorityOpen ? (
        <PriorityEditorSheet
          value={task.priority}
          onChange={(priority) => onUpdatePriority(task.id, priority)}
          onDismiss={() => setIsPriorityOpen(false)}
        />
      ) : null}
    </section>
  );
}

type SortableSubtaskRowProps = {
  child: TaskNode;
  autoEditTaskId: TaskId | null;
  onAutoEditConsumed: () => void;
  onSelectTask: (taskId: TaskId) => void;
  onToggleComplete: (taskId: TaskId) => void;
  onRenameTask: (taskId: TaskId, title: string) => void;
  completeLabel: string;
  // While composing, keep the row in place (and hittable, so the sheet scrolls)
  // but don't let it be dragged/reordered.
  disabled?: boolean;
};

function SortableSubtaskRow({
  child,
  autoEditTaskId,
  onAutoEditConsumed,
  onSelectTask,
  onToggleComplete,
  onRenameTask,
  completeLabel,
  disabled = false,
}: SortableSubtaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: child.id, data: { type: "subtask" }, disabled });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "sortableSubtaskItem isDragging" : "sortableSubtaskItem"}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...(disabled ? {} : listeners)}
    >
      <div
        className={child.children.length > 0 ? "subtaskRow hasProgress" : "subtaskRow"}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button,input")) return;
          onSelectTask(child.id);
        }}
      >
        <input
          className={`check ${getPriorityClass(child.priority)}`}
          type="checkbox"
          checked={child.completed}
          onChange={() => onToggleComplete(child.id)}
          aria-label={completeLabel.replace("{title}", child.title)}
        />
        <EditableTitle
          value={child.title}
          className={child.completed ? "subtaskTitle isCompleted" : "subtaskTitle"}
          inputClassName="subtaskTitle titleInput"
          taskId={child.id}
          autoEditTaskId={autoEditTaskId}
          onAutoEditConsumed={onAutoEditConsumed}
          onClick={() => onSelectTask(child.id)}
          onSave={(title) => onRenameTask(child.id, title)}
        />
        {child.children.length > 0 ? <ProgressBar value={child.progress} /> : null}
      </div>
    </div>
  );
}
