"use client";

import { MouseEvent, useState } from "react";
import type React from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownUp, ChevronDown, ChevronRight, Network } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { AppMessages } from "@/i18n/messages";
import { getTaskSortLabels } from "@/i18n/task-sort-labels";
import { getPriorityClass } from "@/lib/priority";
import type { TaskSortMode } from "@/lib/task-sort";
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
  // The inbox inline-compose ghost row, pinned at the top of the list while a
  // new task is being composed. Rendered outside the sortable context.
  composeSlot?: React.ReactNode;
  composeIndex?: number;
  sortMode: TaskSortMode;
  onOpenSort: () => void;
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
  composeSlot = null,
  composeIndex = 0,
  sortMode,
  onOpenSort,
}: TaskListViewProps) {
  const { language, messages: text } = useLanguage();
  const sortLabels = getTaskSortLabels(language);
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
    return <SortableTaskRow key={root.id} taskId={root.id} reorderEnabled={sortMode === "manual"}>{row}</SortableTaskRow>;
  }

  const keyedComposeSlot = composeSlot ? (
    <div key="compose-slot" style={{ display: "contents" }}>
      {composeSlot}
    </div>
  ) : null;

  const activeRows = interactive ? (
    <SortableContext items={roots.map((root) => root.id)} strategy={verticalListSortingStrategy}>
      {roots.map((root) => renderTaskRow(root))}
    </SortableContext>
  ) : (
    roots.flatMap((root, index) => [
      index === composeIndex ? keyedComposeSlot : null,
      <div key={root.id} style={{ display: "contents" }} inert>
        {renderTaskRow(root, { sortable: false })}
      </div>,
    ]).concat(keyedComposeSlot && composeIndex >= roots.length ? [keyedComposeSlot] : [])
  );

  return (
    <div className="simpleTaskList">
      <button className="taskSortCard" type="button" disabled={!interactive} onClick={onOpenSort}>
        <ArrowDownUp size={16} aria-hidden="true" />
        <span>{sortLabels.title}</span>
        <strong>{sortLabels.modes[sortMode]}</strong>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      {interactive ? keyedComposeSlot : null}
      {roots.length === 0 && !composeSlot ? (
        <p className="placeholderText listPlaceholder">No active tasks.</p>
      ) : null}
      {/* While non-interactive (inline compose, or a neighbouring pager page),
          `inert` removes every row control — most importantly the checkboxes —
          from focus and from iOS's keyboard field navigation. Without it, iOS
          sees fields to step through from the ghost input and shows its
          prev/next/done assistant bar above the keyboard. display:contents
          keeps the wrapper out of the list's layout. */}
      <div style={{ display: "contents" }}>
        {activeRows}
        {completedRoots.length > 0 ? (
          <section className="completedSection" inert={!interactive}>
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
    </div>
  );
}

type SortableTaskRowProps = {
  taskId: TaskId;
  reorderEnabled: boolean;
  children: React.ReactNode;
};

function SortableTaskRow({ taskId, reorderEnabled, children }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: taskId, data: { type: "task" }, disabled: { droppable: !reorderEnabled } });

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
