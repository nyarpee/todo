"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Flag, GitBranch, Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import type { TaskId, TaskNode } from "@/types/task";
import { getScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import { EditableTitle } from "./EditableTitle";
import { ProgressBar } from "./ProgressBar";
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { SubtaskComposer } from "./SubtaskComposer";
import { TrashIcon } from "./TrashIcon";
import type { QuickAddDraft } from "./QuickAddSheet";

type TaskDetailViewProps = {
  task: TaskNode;
  parent: TaskNode | null;
  path: TaskNode[];
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
  parent,
  path,
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
  const detailBodyRef = useRef<HTMLDivElement>(null);

  // While composing, keep the list pinned to the bottom so the newest subtask
  // stays just above the composer. The sheet slide + keyboard open keep changing
  // the body height, so re-pin on every resize/viewport change (instant, not
  // smooth, so it can't be interrupted mid-animation).
  useEffect(() => {
    if (!composerOpen) return;
    const body = detailBodyRef.current;
    if (!body) return;

    const pinToBottom = () => {
      body.scrollTop = body.scrollHeight;
    };
    pinToBottom();

    const observer = new ResizeObserver(pinToBottom);
    observer.observe(body);
    window.visualViewport?.addEventListener("resize", pinToBottom);
    window.visualViewport?.addEventListener("scroll", pinToBottom);

    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", pinToBottom);
      window.visualViewport?.removeEventListener("scroll", pinToBottom);
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
    <section className={composerOpen ? "detailView isComposing" : "detailView"}>
      <div ref={detailBodyRef} className="detailBody">
      {path.length > 1 ? (
        <div className="breadcrumbBar">
          <nav className="breadcrumb" aria-label={text.taskDetail.path}>
            {path.slice(0, -1).map((node, index) => (
              <span className="breadcrumbItem" key={node.id}>
                {index > 0 ? <span className="breadcrumbSeparator">&gt;</span> : null}
                <button
                  className="breadcrumbButton"
                  type="button"
                  onClick={() => onSelectTask(node.id)}
                >
                  {node.title}
                </button>
              </span>
            ))}
          </nav>
        </div>
      ) : null}

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
        {parent ? (
          <section className="detailSection">
            <button className="detailActionRow" type="button" onClick={() => onSelectTask(parent.id)}>
              <GitBranch size={18} aria-hidden="true" />
              <span>{parent.title}</span>
            </button>
          </section>
        ) : null}
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

      {!composerOpen ? (
        <button className="detailDeleteButton" type="button" onClick={handleDelete}>
          <TrashIcon />
          {text.taskDetail.deleteTask}
        </button>
      ) : null}
      </div>

      {composerOpen ? (
        <button
          className="composerScrim"
          type="button"
          aria-label={text.common.close}
          onClick={() => onComposerOpenChange(false)}
        />
      ) : null}
      {composerOpen ? (
        <SubtaskComposer
          placeholder={text.taskDetail.subtaskTitle}
          onAdd={(draft) => onAddChild(task.id, draft)}
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
