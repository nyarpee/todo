"use client";

import { useState } from "react";
import { CalendarClock, Flag, GitBranch, Plus } from "lucide-react";
import type { TaskId, TaskNode } from "@/types/task";
import { getScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import { EditableTitle } from "./EditableTitle";
import { ProgressBar } from "./ProgressBar";
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { TaskCreateSheet } from "./TaskCreateSheet";
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
}: TaskDetailViewProps) {
  const [isSubtaskSheetOpen, setIsSubtaskSheetOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const { labels } = usePriorityLabels();

  function handleDelete() {
    if (task.children.length === 0) {
      onDeleteTask(task.id);
      return;
    }

    if (window.confirm("This task has subtasks. Delete it and all subtasks?")) {
      onDeleteTask(task.id);
    }
  }

  return (
    <section className="detailView">
      {path.length > 1 ? (
        <div className="breadcrumbBar">
          <nav className="breadcrumb" aria-label="Task path">
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

      <div className="detailHeader">
        <input
          className="check"
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggleComplete(task.id)}
          aria-label={`${task.title} complete`}
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
        <ProgressBar value={task.progress} />
      </div>

      <div className="detailFields">
        <section className="detailSection">
          <textarea
            id={`description-${task.id}`}
            className="descriptionInput"
            value={task.description}
            placeholder="Description"
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
            <span>{getScheduleLabel(task.dueDate, task.dueTime)}</span>
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
          <h3>Subtasks</h3>
          <span>{task.children.length}</span>
        </div>
        <div className="subtaskList">
          {task.children.map((child) => (
              <div
                className="subtaskRow"
                key={child.id}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("button,input")) return;
                  onSelectTask(child.id);
                }}
              >
                <input
                  className="check"
                  type="checkbox"
                  checked={child.completed}
                  onChange={() => onToggleComplete(child.id)}
                  aria-label={`${child.title} complete`}
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
                <ProgressBar value={child.progress} />
              </div>
          ))}
        </div>
        <button className="subtaskAddButton" type="button" onClick={() => setIsSubtaskSheetOpen(true)}>
          <Plus size={18} aria-hidden="true" />
          Add subtask
        </button>
      </section>

      <button className="detailDeleteButton" type="button" onClick={handleDelete}>
        <TrashIcon />
        Delete task
      </button>
      {isSubtaskSheetOpen ? (
        <TaskCreateSheet
          ariaLabel="Add subtask"
          placeholder="Subtask title"
          onDismiss={() => setIsSubtaskSheetOpen(false)}
          onSave={(draft) => {
            onAddChild(task.id, draft);
            setIsSubtaskSheetOpen(false);
          }}
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
