"use client";

import { MouseEvent, useState } from "react";
import type React from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Network } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { AppMessages } from "@/i18n/messages";
import { getPriorityClass } from "@/lib/priority";
import type { TaskId, TaskNode } from "@/types/task";
import { EditableTitle } from "./EditableTitle";
import { ProgressBar } from "./ProgressBar";

type TaskListViewProps = {
  roots: TaskNode[];
  completedRoots?: TaskNode[];
  onSelectTask: (taskId: TaskId) => void;
  onOpenMindMap: (taskId: TaskId) => void;
  onToggleComplete: (taskId: TaskId) => void;
  onRenameTask: (taskId: TaskId, title: string) => void;
  autoEditTaskId: TaskId | null;
  onAutoEditConsumed: () => void;
  highlightedTaskId?: TaskId | null;
  isSortingTask?: boolean;
  // Off for neighbouring pages in the group swipe pager: renders a static
  // preview (no drag-and-drop, no navigation) that becomes interactive once the
  // page settles as the active group.
  interactive?: boolean;
};

export function TaskListView({
  roots,
  completedRoots = [],
  onSelectTask,
  onOpenMindMap,
  onToggleComplete,
  onRenameTask,
  autoEditTaskId,
  onAutoEditConsumed,
  highlightedTaskId = null,
  isSortingTask = false,
  interactive = true,
}: TaskListViewProps) {
  const { messages: text } = useLanguage();
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  function handleRowClick(event: MouseEvent<HTMLDivElement>, taskId: TaskId) {
    if (!interactive) return;
    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,.treeOpenButton")) return;
    onSelectTask(taskId);
  }

  function renderTaskRow(root: TaskNode, options: { sortable?: boolean } = {}) {
    const sortable = interactive && (options.sortable ?? true);
    const row = (
      <TaskRow
        key={root.id}
        root={root}
        onRowClick={handleRowClick}
        onSelectTask={onSelectTask}
        onOpenMindMap={onOpenMindMap}
        onToggleComplete={onToggleComplete}
        onRenameTask={onRenameTask}
        autoEditTaskId={autoEditTaskId}
        onAutoEditConsumed={onAutoEditConsumed}
        text={text}
        isHighlighted={root.id === highlightedTaskId}
        interactive={interactive}
      />
    );

    if (!sortable) return row;
    return <SortableTaskRow key={root.id} taskId={root.id}>{row}</SortableTaskRow>;
  }

  const activeRows = interactive ? (
    <SortableContext items={roots.map((root) => root.id)} strategy={verticalListSortingStrategy}>
      {roots.map((root) => renderTaskRow(root))}
    </SortableContext>
  ) : (
    roots.map((root) => renderTaskRow(root, { sortable: false }))
  );

  return (
    <div className="simpleTaskList">
      {roots.length === 0 ? <p className="placeholderText listPlaceholder">No active tasks.</p> : null}
      {activeRows}
      {completedRoots.length > 0 ? (
        <section className="completedSection">
          <button
            className="completedToggle"
            type="button"
            onClick={() => setIsCompletedOpen((current) => !current)}
          >
            <span>{text.lists.completed}</span>
            <strong>{completedRoots.length}</strong>
            <ChevronDown
              className={isCompletedOpen ? "isOpen" : ""}
              size={16}
              aria-hidden="true"
            />
          </button>
          {isCompletedOpen ? (
            <div className="completedList">
              {completedRoots.map((root) => renderTaskRow(root, { sortable: false }))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

type SortableTaskRowProps = {
  taskId: TaskId;
  children: React.ReactNode;
};

function SortableTaskRow({ taskId, children }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: taskId, data: { type: "task" } });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "sortableTaskItem isDragging" : "sortableTaskItem"}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

type TaskRowProps = {
  root: TaskNode;
  onRowClick: (event: MouseEvent<HTMLDivElement>, taskId: TaskId) => void;
  onSelectTask: (taskId: TaskId) => void;
  onOpenMindMap: (taskId: TaskId) => void;
  onToggleComplete: (taskId: TaskId) => void;
  onRenameTask: (taskId: TaskId, title: string) => void;
  autoEditTaskId: TaskId | null;
  onAutoEditConsumed: () => void;
  text: AppMessages;
  isHighlighted: boolean;
  interactive: boolean;
};

function TaskRow({
  root,
  onRowClick,
  onSelectTask,
  onOpenMindMap,
  onToggleComplete,
  onRenameTask,
  autoEditTaskId,
  onAutoEditConsumed,
  text,
  isHighlighted,
  interactive,
}: TaskRowProps) {
  return (
    <div className="simpleTaskSwipe" key={root.id}>
      <div
        className={[
          "simpleTaskRow",
          root.children.length > 0 ? "hasProgress" : "",
          root.completed ? "isCompletedRow" : "",
          isHighlighted ? "isNewlyAdded" : "",
        ].filter(Boolean).join(" ")}
        data-task-id={root.id}
        onClick={(event) => onRowClick(event, root.id)}
      >
        <input
          className={`check ${getPriorityClass(root.priority)}`}
          type="checkbox"
          checked={root.completed}
          disabled={!interactive}
          onChange={() => onToggleComplete(root.id)}
          aria-label={text.taskDetail.complete.replace("{title}", root.title)}
        />
        <div className="simpleTaskContent">
          <EditableTitle
            value={root.title}
            className={root.completed ? "simpleTaskTitle isCompleted" : "simpleTaskTitle"}
            inputClassName="simpleTaskTitle titleInput"
            taskId={root.id}
            autoEditTaskId={autoEditTaskId}
            onAutoEditConsumed={onAutoEditConsumed}
            onClick={() => onSelectTask(root.id)}
            onSave={(title) => onRenameTask(root.id, title)}
          />
        </div>
        {root.children.length > 0 ? <ProgressBar value={root.progress} /> : null}
        <button
          className="treeOpenButton"
          type="button"
          tabIndex={interactive ? undefined : -1}
          onClick={(event) => {
            event.stopPropagation();
            if (interactive) onOpenMindMap(root.id);
          }}
          aria-label={text.taskDetail.treeCanvas.replace("{title}", root.title)}
          title={text.taskDetail.openTree}
        >
          <Network size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
