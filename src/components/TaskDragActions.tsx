"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarArrowDown, CalendarDays, CalendarPlus, Flag, Trash2 } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import type { TaskNode } from "@/types/task";

export const MOVE_TODAY_DROPPABLE_ID = "move-date-today";
export const MOVE_TOMORROW_DROPPABLE_ID = "move-date-tomorrow";
export const MOVE_CALENDAR_DROPPABLE_ID = "move-date-calendar";
export const MOVE_DATE_CORRIDOR_DROPPABLE_ID = "move-date-corridor";
export const PRIORITY_NONE_DROPPABLE_ID = "priority-none";
export const PRIORITY_LOW_DROPPABLE_ID = "priority-low";
export const PRIORITY_MEDIUM_DROPPABLE_ID = "priority-medium";
export const PRIORITY_HIGH_DROPPABLE_ID = "priority-high";
export const PRIORITY_CORRIDOR_DROPPABLE_ID = "priority-corridor";
export const ACTION_DOCK_CORRIDOR_DROPPABLE_ID = "action-dock-corridor";
export const ACTION_FOCUS_CORRIDOR_DROPPABLE_ID = "action-focus-corridor";

const ACTION_IDS = new Set([
  MOVE_TODAY_DROPPABLE_ID,
  MOVE_TOMORROW_DROPPABLE_ID,
  MOVE_CALENDAR_DROPPABLE_ID,
  MOVE_DATE_CORRIDOR_DROPPABLE_ID,
  PRIORITY_NONE_DROPPABLE_ID,
  PRIORITY_LOW_DROPPABLE_ID,
  PRIORITY_MEDIUM_DROPPABLE_ID,
  PRIORITY_HIGH_DROPPABLE_ID,
  PRIORITY_CORRIDOR_DROPPABLE_ID,
  ACTION_DOCK_CORRIDOR_DROPPABLE_ID,
  ACTION_FOCUS_CORRIDOR_DROPPABLE_ID,
  "trash-drop",
]);

export function isTaskDragActionId(id: string | number): boolean {
  return ACTION_IDS.has(String(id));
}

export function isTaskDragCorridorId(id: string | number): boolean {
  return (
    id === MOVE_DATE_CORRIDOR_DROPPABLE_ID ||
    id === PRIORITY_CORRIDOR_DROPPABLE_ID ||
    id === ACTION_DOCK_CORRIDOR_DROPPABLE_ID ||
    id === ACTION_FOCUS_CORRIDOR_DROPPABLE_ID
  );
}

export function getTaskDragPriority(overId: string | null): TaskNode["priority"] | null {
  if (overId === PRIORITY_HIGH_DROPPABLE_ID) return "high";
  if (overId === PRIORITY_MEDIUM_DROPPABLE_ID) return "medium";
  if (overId === PRIORITY_LOW_DROPPABLE_ID) return "low";
  if (overId === PRIORITY_NONE_DROPPABLE_ID) return "none";
  return null;
}

export function isPriorityDragAction(overId: string | null): boolean {
  return (
    getTaskDragPriority(overId) !== null ||
    overId === PRIORITY_CORRIDOR_DROPPABLE_ID
  );
}

export function TaskDragOverlayContent({ task, overId }: { task: TaskNode; overId: string | null }) {
  const priority = getTaskDragPriority(overId) ?? "none";
  const className = overId === "trash-drop"
    ? "dragOverlayMorph isAction isDelete"
    : isPriorityDragAction(overId)
      ? "dragOverlayMorph isAction isPriority"
      : overId && isTaskDragActionId(overId)
        ? "dragOverlayMorph isAction isDate"
        : "dragOverlayMorph";

  return (
    <div className={className}>
      <div className="dragOverlayTask">
        <span
          className={`priorityDot taskPriorityDot ${task.priority === "none" ? "priority-none" : `priority-${task.priority}`}`}
          aria-hidden="true"
        />
        <span>{task.title}</span>
      </div>
      <div className={`dragOverlayActionToken priority-${priority}`} aria-hidden="true">
        {overId === "trash-drop" ? (
          <Trash2 size={28} />
        ) : isPriorityDragAction(overId) ? (
          <Flag size={28} />
        ) : (
          <CalendarArrowDown size={28} />
        )}
      </div>
    </div>
  );
}

type TaskDragActionsProps = {
  active: boolean;
  overId: string | null;
  todayLabel: string;
  tomorrowLabel: string;
  calendarLabel: string;
  moveDateLabel: string;
  moveSuffix: string;
  selectDateLabel: string;
  priorityActionLabel: string;
  priorityLabels: { high: string; medium: string; low: string; none: string };
  priorityFeedback: (label: string) => string;
  deleteLabel: string;
};

export function TaskDragActions(props: TaskDragActionsProps) {
  const [mounted, setMounted] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"date" | "priority" | null>(null);
  const dateOpen = activeMenu === "date";
  const priorityOpen = activeMenu === "priority";

  const todayDrop = useDroppable({ id: MOVE_TODAY_DROPPABLE_ID, disabled: !props.active });
  const tomorrowDrop = useDroppable({ id: MOVE_TOMORROW_DROPPABLE_ID, disabled: !props.active || !dateOpen });
  const calendarDrop = useDroppable({ id: MOVE_CALENDAR_DROPPABLE_ID, disabled: !props.active || !dateOpen });
  const dateCorridorDrop = useDroppable({ id: MOVE_DATE_CORRIDOR_DROPPABLE_ID, disabled: !props.active || !dateOpen });
  const noneDrop = useDroppable({ id: PRIORITY_NONE_DROPPABLE_ID, disabled: !props.active });
  const lowDrop = useDroppable({ id: PRIORITY_LOW_DROPPABLE_ID, disabled: !props.active || !priorityOpen });
  const mediumDrop = useDroppable({ id: PRIORITY_MEDIUM_DROPPABLE_ID, disabled: !props.active || !priorityOpen });
  const highDrop = useDroppable({ id: PRIORITY_HIGH_DROPPABLE_ID, disabled: !props.active || !priorityOpen });
  const priorityCorridorDrop = useDroppable({ id: PRIORITY_CORRIDOR_DROPPABLE_ID, disabled: !props.active || !priorityOpen });
  const deleteDrop = useDroppable({ id: "trash-drop", disabled: !props.active });
  const dockCorridorDrop = useDroppable({
    id: ACTION_DOCK_CORRIDOR_DROPPABLE_ID,
    disabled: !props.active,
  });
  const focusCorridorDrop = useDroppable({
    id: ACTION_FOCUS_CORRIDOR_DROPPABLE_ID,
    disabled: !props.active || activeMenu === null,
  });

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!props.active) setActiveMenu(null);
  }, [props.active]);
  useEffect(() => {
    if (todayDrop.isOver) setActiveMenu("date");
    if (noneDrop.isOver) setActiveMenu("priority");
    if (deleteDrop.isOver) setActiveMenu(null);
  }, [todayDrop.isOver, noneDrop.isOver, deleteDrop.isOver]);
  useEffect(() => {
    if (
      activeMenu === "date" &&
      props.overId !== MOVE_TODAY_DROPPABLE_ID &&
      props.overId !== MOVE_TOMORROW_DROPPABLE_ID &&
      props.overId !== MOVE_CALENDAR_DROPPABLE_ID &&
      props.overId !== MOVE_DATE_CORRIDOR_DROPPABLE_ID &&
      props.overId !== ACTION_DOCK_CORRIDOR_DROPPABLE_ID &&
      props.overId !== ACTION_FOCUS_CORRIDOR_DROPPABLE_ID
    ) {
      setActiveMenu(null);
    }
    if (
      activeMenu === "priority" &&
      props.overId !== PRIORITY_NONE_DROPPABLE_ID &&
      props.overId !== PRIORITY_LOW_DROPPABLE_ID &&
      props.overId !== PRIORITY_MEDIUM_DROPPABLE_ID &&
      props.overId !== PRIORITY_HIGH_DROPPABLE_ID &&
      props.overId !== PRIORITY_CORRIDOR_DROPPABLE_ID &&
      props.overId !== ACTION_DOCK_CORRIDOR_DROPPABLE_ID &&
      props.overId !== ACTION_FOCUS_CORRIDOR_DROPPABLE_ID
    ) {
      setActiveMenu(null);
    }
  }, [activeMenu, props.overId]);

  if (!mounted || !props.active) return null;

  const feedback = getFeedbackLabel(props);
  const dateBaseLabel = dateOpen
    ? `${props.todayLabel}${props.moveSuffix}`
    : props.moveDateLabel;
  const priorityBaseLabel = priorityOpen
    ? props.priorityLabels.none
    : props.priorityActionLabel;
  const menuFocusClass = dateOpen
    ? "taskDragMenus isDateFocused"
    : priorityOpen
      ? "taskDragMenus isPriorityFocused"
      : deleteDrop.isOver
        ? "taskDragMenus isDeleteFocused"
        : "taskDragMenus";

  return createPortal(
    <>
      <div className={activeMenu || deleteDrop.isOver ? "taskDragBackdrop isVisible" : "taskDragBackdrop"} />
      <div className="taskDragActionLayer">
        <div className={feedback ? "taskDragFeedback isVisible" : "taskDragFeedback"}>
          {feedback}
        </div>
        <div className={menuFocusClass}>
          <div ref={focusCorridorDrop.setNodeRef} className="taskDropCorridor isFocusArea" aria-hidden="true" />
          <div ref={dockCorridorDrop.setNodeRef} className="taskDropCorridor isDock" aria-hidden="true" />
          <div ref={dateCorridorDrop.setNodeRef} className="taskDropCorridor isDate" aria-hidden="true" />
          <div ref={priorityCorridorDrop.setNodeRef} className="taskDropCorridor isPriority" aria-hidden="true" />

          <ActionTarget drop={calendarDrop} className="taskSubTarget isDate level2" hidden={!dateOpen} label={props.selectDateLabel}>
            <CalendarPlus size={19} aria-hidden="true" /><span>{props.calendarLabel}</span>
          </ActionTarget>
          <ActionTarget drop={tomorrowDrop} className="taskSubTarget isDate level1" hidden={!dateOpen} label={`${props.tomorrowLabel}${props.moveSuffix}`}>
            <span>{props.tomorrowLabel}</span>
          </ActionTarget>

          <ActionTarget drop={highDrop} className="taskSubTarget isPriority level3 priority-high" hidden={!priorityOpen} label={props.priorityFeedback(props.priorityLabels.high)}>
            <Flag size={19} aria-hidden="true" /><span>{props.priorityLabels.high}</span>
          </ActionTarget>
          <ActionTarget drop={mediumDrop} className="taskSubTarget isPriority level2 priority-medium" hidden={!priorityOpen} label={props.priorityFeedback(props.priorityLabels.medium)}>
            <Flag size={19} aria-hidden="true" /><span>{props.priorityLabels.medium}</span>
          </ActionTarget>
          <ActionTarget drop={lowDrop} className="taskSubTarget isPriority level1 priority-low" hidden={!priorityOpen} label={props.priorityFeedback(props.priorityLabels.low)}>
            <Flag size={19} aria-hidden="true" /><span>{props.priorityLabels.low}</span>
          </ActionTarget>

          <div className="taskDragActions">
            <div className="taskEditActions">
              <div ref={todayDrop.setNodeRef} className={todayDrop.isOver ? "taskMoveDropTarget isOver" : "taskMoveDropTarget"} aria-label={dateBaseLabel}>
                <CalendarDays size={20} aria-hidden="true" /><span>{dateBaseLabel}</span>
              </div>
              <div ref={noneDrop.setNodeRef} className={noneDrop.isOver ? "taskPriorityDropTarget isOver" : "taskPriorityDropTarget"} aria-label={priorityBaseLabel}>
                <Flag size={20} aria-hidden="true" /><span>{priorityBaseLabel}</span>
              </div>
            </div>
            <div ref={deleteDrop.setNodeRef} className={deleteDrop.isOver ? "taskDeleteDropTarget isOver" : "taskDeleteDropTarget"} aria-label={props.deleteLabel}>
              <Trash2 size={22} aria-hidden="true" /><span>{props.deleteLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

type ActionTargetProps = {
  drop: ReturnType<typeof useDroppable>;
  className: string;
  hidden: boolean;
  label: string;
  children: React.ReactNode;
};

function ActionTarget({ drop, className, hidden, label, children }: ActionTargetProps) {
  return (
    <div
      ref={drop.setNodeRef}
      className={drop.isOver ? `${className} isOver` : className}
      aria-label={label}
      aria-hidden={hidden}
    >
      {children}
    </div>
  );
}

function getFeedbackLabel(props: TaskDragActionsProps): string {
  if (props.overId === MOVE_TODAY_DROPPABLE_ID) return `${props.todayLabel}${props.moveSuffix}`;
  if (props.overId === MOVE_TOMORROW_DROPPABLE_ID) return `${props.tomorrowLabel}${props.moveSuffix}`;
  if (props.overId === MOVE_CALENDAR_DROPPABLE_ID) return props.selectDateLabel;
  if (props.overId === PRIORITY_HIGH_DROPPABLE_ID) return props.priorityFeedback(props.priorityLabels.high);
  if (props.overId === PRIORITY_MEDIUM_DROPPABLE_ID) return props.priorityFeedback(props.priorityLabels.medium);
  if (props.overId === PRIORITY_LOW_DROPPABLE_ID) return props.priorityFeedback(props.priorityLabels.low);
  if (props.overId === PRIORITY_NONE_DROPPABLE_ID) return props.priorityFeedback(props.priorityLabels.none);
  if (props.overId === "trash-drop") return props.deleteLabel;
  return "";
}
