"use client";

import { MouseEvent, PointerEvent, useRef, useState } from "react";
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
import { TrashIcon } from "./TrashIcon";

type TaskListViewProps = {
  roots: TaskNode[];
  completedRoots?: TaskNode[];
  onSelectTask: (taskId: TaskId) => void;
  onOpenMindMap: (taskId: TaskId) => void;
  onToggleComplete: (taskId: TaskId) => void;
  onRenameTask: (taskId: TaskId, title: string) => void;
  onDeleteTask: (taskId: TaskId) => void;
  autoEditTaskId: TaskId | null;
  onAutoEditConsumed: () => void;
  highlightedTaskId?: TaskId | null;
};

export function TaskListView({
  roots,
  completedRoots = [],
  onSelectTask,
  onOpenMindMap,
  onToggleComplete,
  onRenameTask,
  onDeleteTask,
  autoEditTaskId,
  onAutoEditConsumed,
  highlightedTaskId = null,
}: TaskListViewProps) {
  const { messages: text } = useLanguage();
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [revealedTaskId, setRevealedTaskId] = useState<TaskId | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<TaskId | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const swipeIntentRef = useRef<"pending" | "swiping" | "scrolling">("pending");
  const swipeRevealThresholdRef = useRef(88);
  const didDragRef = useRef(false);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, taskId: TaskId) {
    const target = event.target as HTMLElement;
    if (isSwipeExcludedTarget(target)) return;

    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    swipeIntentRef.current = "pending";
    swipeRevealThresholdRef.current = getSwipeRevealThreshold(event.currentTarget.clientWidth);
    didDragRef.current = false;
    setDraggingTaskId(taskId);
    setDragOffset(revealedTaskId === taskId ? -88 : 0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>, taskId: TaskId) {
    if (draggingTaskId !== taskId) return;

    const deltaX = event.clientX - dragStartXRef.current;
    const deltaY = event.clientY - dragStartYRef.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const baseOffset = revealedTaskId === taskId ? -88 : 0;

    if (swipeIntentRef.current === "pending") {
      if (absDeltaX < SWIPE_START_DISTANCE && absDeltaY < SWIPE_START_DISTANCE) return;

      didDragRef.current = true;

      if (absDeltaY > absDeltaX) {
        swipeIntentRef.current = "scrolling";
        setDraggingTaskId(null);
        setDragOffset(baseOffset);
        return;
      }

      if (deltaX > 0 && revealedTaskId !== taskId) {
        swipeIntentRef.current = "scrolling";
        setDraggingTaskId(null);
        setDragOffset(0);
        return;
      }

      swipeIntentRef.current = "swiping";
      didDragRef.current = true;
    }

    if (swipeIntentRef.current !== "swiping") return;

    const nextOffset = Math.min(0, Math.max(-88, baseOffset + deltaX));
    event.preventDefault();
    setDragOffset(nextOffset);
  }

  function handlePointerUp(taskId: TaskId) {
    if (draggingTaskId !== taskId) return;

    const shouldReveal = Math.abs(dragOffset) >= swipeRevealThresholdRef.current;

    if (shouldReveal) {
      setRevealedTaskId(taskId);
      setDragOffset(-88);
    } else {
      setRevealedTaskId(null);
      setDragOffset(0);
    }

    setDraggingTaskId(null);
    swipeIntentRef.current = "pending";
  }

  function handleRowClick(event: MouseEvent<HTMLDivElement>, taskId: TaskId) {
    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,.treeOpenButton,.swipeDeleteButton")) return;

    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    onSelectTask(taskId);
  }

  return (
    <div className="simpleTaskList">
      {roots.length === 0 ? <p className="placeholderText listPlaceholder">No active tasks.</p> : null}
      <SortableContext items={roots.map((root) => root.id)} strategy={verticalListSortingStrategy}>
        {roots.map((root) => renderTaskRow(root))}
      </SortableContext>
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
              {completedRoots.map((root) => renderTaskRow(root, { canDelete: false }))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  function renderTaskRow(root: TaskNode, options: { canDelete?: boolean } = {}) {
    const canDelete = options.canDelete ?? true;
    const row = (
      <TaskRow
        key={root.id}
        root={root}
        canDelete={canDelete}
        draggingTaskId={draggingTaskId}
        dragOffset={dragOffset}
        revealedTaskId={revealedTaskId}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onRowClick={handleRowClick}
        onSelectTask={onSelectTask}
        onOpenMindMap={onOpenMindMap}
        onToggleComplete={onToggleComplete}
        onRenameTask={onRenameTask}
        onDeleteTask={onDeleteTask}
        autoEditTaskId={autoEditTaskId}
        onAutoEditConsumed={onAutoEditConsumed}
        text={text}
        isHighlighted={root.id === highlightedTaskId}
      />
    );

    if (!canDelete) return row;

    return <SortableTaskRow key={root.id} taskId={root.id}>{row}</SortableTaskRow>;
  }
}

const SWIPE_START_DISTANCE = 24;

function getSwipeRevealThreshold(rowWidth: number): number {
  return Math.min(88, Math.max(56, rowWidth * 0.28));
}

function isSwipeExcludedTarget(target: HTMLElement): boolean {
  return Boolean(
    target.closest(
      "input,textarea,select,[contenteditable='true'],.check,.treeOpenButton,.swipeDeleteButton",
    ),
  );
}

type SortableTaskRowProps = {
  taskId: TaskId;
  children: React.ReactNode;
};

function SortableTaskRow({ taskId, children }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: taskId });

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
  canDelete: boolean;
  draggingTaskId: TaskId | null;
  dragOffset: number;
  revealedTaskId: TaskId | null;
  onPointerDown: (event: PointerEvent<HTMLDivElement>, taskId: TaskId) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>, taskId: TaskId) => void;
  onPointerUp: (taskId: TaskId) => void;
  onRowClick: (event: MouseEvent<HTMLDivElement>, taskId: TaskId) => void;
  onSelectTask: (taskId: TaskId) => void;
  onOpenMindMap: (taskId: TaskId) => void;
  onToggleComplete: (taskId: TaskId) => void;
  onRenameTask: (taskId: TaskId, title: string) => void;
  onDeleteTask: (taskId: TaskId) => void;
  autoEditTaskId: TaskId | null;
  onAutoEditConsumed: () => void;
  text: AppMessages;
  isHighlighted: boolean;
};

function TaskRow({
  root,
  canDelete,
  draggingTaskId,
  dragOffset,
  revealedTaskId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRowClick,
  onSelectTask,
  onOpenMindMap,
  onToggleComplete,
  onRenameTask,
  onDeleteTask,
  autoEditTaskId,
  onAutoEditConsumed,
  text,
  isHighlighted,
}: TaskRowProps) {
    const isDragging = canDelete && draggingTaskId === root.id;
    const isRevealed = canDelete && revealedTaskId === root.id;

    return (
      <div className="simpleTaskSwipe" key={root.id}>
        <div
          className={[
            "simpleTaskRow",
            root.children.length > 0 ? "hasProgress" : "",
            root.completed ? "isCompletedRow" : "",
            isHighlighted ? "isNewlyAdded" : "",
          ].filter(Boolean).join(" ")}
          style={{
            transform: `translateX(${
              isDragging
                ? dragOffset
                : isRevealed
                  ? -88
                  : 0
            }px)`,
          }}
          onClick={(event) => onRowClick(event, root.id)}
          onPointerDown={canDelete ? (event) => onPointerDown(event, root.id) : undefined}
          onPointerMove={canDelete ? (event) => onPointerMove(event, root.id) : undefined}
          onPointerUp={canDelete ? () => onPointerUp(root.id) : undefined}
          onPointerCancel={canDelete ? () => onPointerUp(root.id) : undefined}
        >
          <input
            className={`check ${getPriorityClass(root.priority)}`}
            type="checkbox"
            checked={root.completed}
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
            onClick={(event) => {
              event.stopPropagation();
              onOpenMindMap(root.id);
            }}
            aria-label={text.taskDetail.treeCanvas.replace("{title}", root.title)}
            title={text.taskDetail.openTree}
          >
            <Network size={18} aria-hidden="true" />
          </button>
        </div>
        {canDelete ? (
          <button
            className="swipeDeleteButton"
            type="button"
            onClick={() => confirmDelete(root, onDeleteTask, text.taskDetail.deleteWithSubtasks)}
            aria-label={text.taskDetail.deleteTask}
          >
            <TrashIcon />
          </button>
        ) : null}
      </div>
    );
}

function confirmDelete(task: TaskNode, onDeleteTask: (taskId: TaskId) => void, message: string) {
  if (task.children.length === 0) {
    onDeleteTask(task.id);
    return;
  }

  if (window.confirm(message)) {
    onDeleteTask(task.id);
  }
}
