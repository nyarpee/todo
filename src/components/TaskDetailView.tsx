"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Flag, GripVertical, Plus, Trash2 } from "lucide-react";
import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
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
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { SubtaskQuickAddSheet } from "./SubtaskQuickAddSheet";
import { TaskPathBreadcrumb, type PathCrumb } from "./TaskPathBreadcrumb";
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
  autoEditTaskId: TaskId | null;
  onAutoEditConsumed: () => void;
  onAddChild: (parentId: TaskId, draft?: QuickAddDraft) => void;
  onReorderChild: (activeId: TaskId, overId: TaskId) => void;
  composerOpen: boolean;
  onComposerOpenChange: (open: boolean) => void;
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
  autoEditTaskId,
  onAutoEditConsumed,
  onAddChild,
  onReorderChild,
  composerOpen,
  onComposerOpenChange,
}: TaskDetailViewProps) {
  const { messages: text } = useLanguage();
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  // Press-and-hold to start a reorder drag; a quick tap on the handle still lets
  // taps elsewhere on the row navigate/edit. Mirrors the inbox list sensors.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );
  const translatedPriorityLabels = useMemo(() => getTranslatedPriorityLabels(text), [text]);
  const { labels } = usePriorityLabels(translatedPriorityLabels);

  // Path to the current task's *parent* (group + ancestors, current excluded);
  // the trailing ">" leads into the title below it.
  const detailCrumbs: PathCrumb[] = [
    { id: null, label: groupName },
    ...path.slice(0, -1).map((node) => ({ id: node.id, label: node.title })),
    { id: null, label: task.title },
  ];
  // Path to the current task itself (group + full ancestors + current); the
  // trailing ">" leads into the composer input — you're adding inside here.
  // Ancestors are tappable (jump up); the current task (last) is a non-tappable
  // emphasized "you are here" label.
  const composerCrumbs: PathCrumb[] = [
    { id: null, label: groupName },
    ...path.slice(0, -1).map((node) => ({ id: node.id, label: node.title })),
    { id: null, label: task.title },
  ];
  const viewRef = useRef<HTMLElement>(null);

  // While the floating composer is open, pin the BOTTOM of the subtask list just
  // above the composer (mirrors the calendar's compose behaviour), so the newest
  // subtask lands right above the sheet. The spacer below is sized to the
  // composer's occluded height so there's always room to scroll the list's tail
  // up to it. On open (and keyboard resize) we jump instantly ("auto") so the
  // sheet appears already docked under the last subtask, with no visible scroll.
  const alignSubtaskTail = (behavior: ScrollBehavior) => {
    const view = viewRef.current;
    const sheet = view?.closest(".draggableSheet");
    if (!(sheet instanceof HTMLElement)) return;
    const subtaskList = view?.querySelector<HTMLElement>(".subtaskList");
    const spacer = view?.querySelector<HTMLElement>(".detailComposerSpacer");

    const composer = document.querySelector(".subtaskAddLayer .quickAddSheet");
    const occluded = composer
      ? window.innerHeight - composer.getBoundingClientRect().top + 8
      : 220;
    if (spacer) spacer.style.height = `${Math.round(occluded)}px`;
    sheet.style.scrollPaddingBottom = `${Math.round(occluded)}px`;
    if (subtaskList) {
      subtaskList.scrollIntoView({ block: "end", behavior });
    } else {
      sheet.scrollTop = sheet.scrollHeight;
    }
  };

  // On open + keyboard resize: dock instantly under the last subtask.
  useEffect(() => {
    if (!composerOpen) return;
    const sheet = viewRef.current?.closest(".draggableSheet");
    if (!(sheet instanceof HTMLElement)) return;

    const alignInstant = () => alignSubtaskTail("auto");
    const openTimer = window.setTimeout(alignInstant, 60);
    window.visualViewport?.addEventListener("resize", alignInstant);

    return () => {
      window.clearTimeout(openTimer);
      window.visualViewport?.removeEventListener("resize", alignInstant);
      sheet.style.scrollPaddingBottom = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerOpen]);

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

  function handleSubtaskDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorderChild(String(active.id), String(over.id));
  }

  function handleDeleteSubtask(child: TaskNode) {
    if (child.children.length > 0 && !window.confirm(text.taskDetail.deleteWithSubtasks)) {
      return;
    }
    onDeleteTask(child.id);
  }

  return (
    <section ref={viewRef} className="detailView">
      <TaskPathBreadcrumb
        className="detailPath"
        crumbs={detailCrumbs}
        ariaLabel={text.taskDetail.path}
        onNavigate={onSelectTask}
        trailingSeparator={false}
      />

      <div className={task.children.length > 0 ? "detailHeader hasProgress" : "detailHeader"}>
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

      <div className="detailFields">
        <section className="detailSection">
          <textarea
            id={`description-${task.id}`}
            className="descriptionInput"
            value={task.description}
            placeholder={text.taskDetail.description}
            onChange={(event) => onUpdateDescription(task.id, event.target.value)}
          />
        </section>
        <section className="detailSection">
          <button
            className={task.dueDate ? "detailActionRow" : "detailActionRow isEmpty"}
            type="button"
            onClick={() => onOpenSchedule(task.id)}
          >
            <CalendarClock size={18} aria-hidden="true" />
            <span>{getScheduleLabel(task.dueDate, task.dueTime, {
              locale: text.common.locale,
              noDateLabel: text.common.noDate,
            })}</span>
          </button>
        </section>
        <section className="detailSection">
          <button
            className="detailActionRow"
            type="button"
            onClick={() => setIsPriorityOpen(true)}
          >
            <Flag size={18} aria-hidden="true" />
            <span className="priorityValue">
              <span className={`priorityDot ${getPriorityClass(task.priority)}`} aria-hidden="true" />
              {getPriorityLabel(task.priority, labels)}
            </span>
          </button>
        </section>
      </div>

      <section className="subtasksSection">
        <div className="subtasksHeader">
          <h3>{text.taskDetail.subtasks}</h3>
          <span>{task.children.length}</span>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSubtaskDragEnd}
        >
          <SortableContext
            items={task.children.map((child) => child.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="subtaskList">
              {task.children.map((child) => (
                <SortableSubtaskRow
                  key={child.id}
                  child={child}
                  autoEditTaskId={autoEditTaskId}
                  onAutoEditConsumed={onAutoEditConsumed}
                  onSelectTask={onSelectTask}
                  onToggleComplete={onToggleComplete}
                  onRenameTask={onRenameTask}
                  onDelete={handleDeleteSubtask}
                  completeLabel={text.taskDetail.complete}
                  reorderLabel={text.taskDetail.reorderSubtask}
                  deleteLabel={text.taskDetail.deleteSubtask}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {!composerOpen ? (
          <button className="subtaskAddButton" type="button" onClick={() => onComposerOpenChange(true)}>
            <Plus size={18} aria-hidden="true" />
            {text.taskDetail.addSubtask}
          </button>
        ) : null}
      </section>

      <button className="detailDeleteButton" type="button" onClick={handleDelete}>
        <TrashIcon />
        {text.taskDetail.deleteTask}
      </button>
      {composerOpen ? <div className="detailComposerSpacer" aria-hidden="true" /> : null}
      {composerOpen ? (
        <SubtaskQuickAddSheet
          placeholder={text.taskDetail.subtaskTitle}
          crumbs={composerCrumbs}
          onNavigate={onSelectTask}
          onAdd={(draft) => onAddChild(task.id, draft)}
          onClose={() => onComposerOpenChange(false)}
        />
      ) : null}
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
  onDelete: (child: TaskNode) => void;
  completeLabel: string;
  reorderLabel: string;
  deleteLabel: string;
};

function SortableSubtaskRow({
  child,
  autoEditTaskId,
  onAutoEditConsumed,
  onSelectTask,
  onToggleComplete,
  onRenameTask,
  onDelete,
  completeLabel,
  reorderLabel,
  deleteLabel,
}: SortableSubtaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: child.id, data: { type: "subtask" } });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "sortableSubtaskItem isDragging" : "sortableSubtaskItem"}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div
        className={child.children.length > 0 ? "subtaskRow hasProgress" : "subtaskRow"}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button,input")) return;
          onSelectTask(child.id);
        }}
      >
        <button
          type="button"
          className="subtaskDragHandle"
          aria-label={reorderLabel}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
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
        <button
          type="button"
          className="subtaskDeleteButton"
          aria-label={deleteLabel}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(child);
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
