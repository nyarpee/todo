"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Flag, Plus } from "lucide-react";
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
  composerOpen,
  onComposerOpenChange,
}: TaskDetailViewProps) {
  const { messages: text } = useLanguage();
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
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

  // While the floating composer is open, keep the detail sheet scrolled to the
  // bottom (the spacer keeps that region clear of the composer), so the newest
  // subtask always sits right above the composer: on open, after each add, and
  // when the keyboard resizes the sheet.
  useEffect(() => {
    if (!composerOpen) return;
    const sheet = viewRef.current?.closest(".draggableSheet");
    if (!(sheet instanceof HTMLElement)) return;

    const pinToBottom = () => {
      sheet.scrollTop = sheet.scrollHeight;
    };
    const openTimer = window.setTimeout(pinToBottom, 80);
    window.visualViewport?.addEventListener("resize", pinToBottom);

    return () => {
      window.clearTimeout(openTimer);
      window.visualViewport?.removeEventListener("resize", pinToBottom);
    };
  }, [composerOpen, task.children.length]);

  function handleDelete() {
    if (task.children.length === 0) {
      onDeleteTask(task.id);
      return;
    }

    if (window.confirm(text.taskDetail.deleteWithSubtasks)) {
      onDeleteTask(task.id);
    }
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
        <div className="subtaskList">
          {task.children.map((child) => (
              <div
                className={child.children.length > 0 ? "subtaskRow hasProgress" : "subtaskRow"}
                key={child.id}
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
                  aria-label={text.taskDetail.complete.replace("{title}", child.title)}
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
          ))}
        </div>
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
