"use client";

import { ChevronRight, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TaskGroup, TaskGroupId, TaskId, TaskNode } from "@/types/task";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

export type TaskLocationTarget = {
  groupId: TaskGroupId;
  parentTaskId: TaskId | null;
};

type TaskLocationPickerProps = {
  groups: TaskGroup[];
  tasks: TaskNode[];
  value: TaskLocationTarget;
  onChange: (target: TaskLocationTarget) => void;
  onDismiss: () => void;
};

// The destination picker for a compose session. Its header band mirrors the
// compose bar's location strip — the sheet reads as that strip, expanded —
// with the path's crumbs individually tappable to climb back up. Below it,
// the child list drills down. The group rail only appears at a group root:
// switching trees is a root-level move, so the rail shows exactly when the
// path is at a root.
export function TaskLocationPicker({
  groups,
  tasks,
  value,
  onChange,
  onDismiss,
}: TaskLocationPickerProps) {
  const { messages: text } = useLanguage();
  const railRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<HTMLDivElement | null>(null);
  const hasCenteredRef = useRef(false);
  const currentGroup = groups.find((group) => group.id === value.groupId) ?? groups[0] ?? null;
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const ancestors = useMemo(() => {
    const path: TaskNode[] = [];
    let current = value.parentTaskId ? tasksById.get(value.parentTaskId) ?? null : null;
    while (current) {
      path.unshift(current);
      current = current.parentId ? tasksById.get(current.parentId) ?? null : null;
    }
    return path;
  }, [tasksById, value.parentTaskId]);
  const isAtRoot = value.parentTaskId === null;
  // Completed tasks are not offered as destinations — you don't compose new
  // work under something already done.
  const children = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !task.completed &&
          task.groupId === value.groupId &&
          task.parentId === value.parentTaskId,
      ),
    [tasks, value.groupId, value.parentTaskId],
  );

  // Keep the selected chip visible in the rail (it only exists at a root):
  // jump instantly on open, glide when the selection changes.
  useEffect(() => {
    const chip = railRef.current?.querySelector<HTMLElement>(".taskLocationGroup.isSelected");
    if (!chip) return;
    chip.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: hasCenteredRef.current ? "smooth" : "auto",
    });
    hasCenteredRef.current = true;
  }, [value.groupId, isAtRoot]);

  // Like the compose bar's strip, the tail of the path — the destination — must
  // stay visible: keep the header band scrolled to its end.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    path.scrollTo({ left: path.scrollWidth });
  }, [value.groupId, value.parentTaskId]);

  // Keep the ghost row visible while this sheet is up: on open, and every time
  // the target moves it, scroll whatever container holds the ghost so it sits
  // in the band above the sheet (it otherwise hides behind the sheet or the
  // keyboard, especially on the calendar). The short delay lets the view under
  // the sheet finish re-rendering the ghost at its new location first.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const sheet = pathRef.current?.closest(".draggableSheet");
      const ghost = document.querySelector<HTMLElement>(".composeGhostRow");
      if (!(sheet instanceof HTMLElement) || !ghost) return;

      const margin = 12;
      const sheetTop = sheet.getBoundingClientRect().top;
      const visibleTop = (window.visualViewport?.offsetTop ?? 0) + margin;
      const ghostRect = ghost.getBoundingClientRect();

      let delta = 0;
      if (ghostRect.bottom > sheetTop - margin) {
        delta = ghostRect.bottom - (sheetTop - margin);
      } else if (ghostRect.top < visibleTop) {
        delta = ghostRect.top - visibleTop;
      }
      if (delta === 0) return;

      findScrollableAncestor(ghost)?.scrollBy({ top: delta, behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [value.groupId, value.parentTaskId]);

  if (!currentGroup) return null;

  return (
    <DraggableBottomSheet
      ariaLabel={text.lists.area}
      className="taskLocationPickerSheet"
      layerClassName="composeSheetLayer"
      dismissOnBackdrop
      onDismiss={onDismiss}
    >
      <div className="taskLocationHeader">
        <MapPin size={15} aria-hidden="true" />
        <div ref={pathRef} className="taskLocationPath" aria-label="Task location">
          <button
            type="button"
            className={ancestors.length === 0 ? "taskLocationCrumb isCurrent" : "taskLocationCrumb"}
            onClick={() => onChange({ groupId: currentGroup.id, parentTaskId: null })}
          >
            {currentGroup.name}
          </button>
          {ancestors.map((task, index) => (
            <span className="taskLocationCrumbWrap" key={task.id}>
              <ChevronRight size={14} aria-hidden="true" />
              <button
                type="button"
                className={
                  index === ancestors.length - 1 ? "taskLocationCrumb isCurrent" : "taskLocationCrumb"
                }
                onClick={() => onChange({ groupId: task.groupId, parentTaskId: task.id })}
              >
                {task.title}
              </button>
            </span>
          ))}
        </div>
      </div>

      {isAtRoot ? (
        <div ref={railRef} className="taskLocationGroupRail" role="list" aria-label={text.lists.area}>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={group.id === value.groupId ? "taskLocationGroup isSelected" : "taskLocationGroup"}
              onClick={() => onChange({ groupId: group.id, parentTaskId: null })}
            >
              {group.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="taskLocationChildren" role="list">
        {children.map((task) => (
          <button
            key={task.id}
            type="button"
            className="taskLocationChild"
            onClick={() => onChange({ groupId: task.groupId, parentTaskId: task.id })}
          >
            <span>{task.title}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ))}
        {children.length === 0 ? (
          <p className="taskLocationEmpty">{text.emptyTasks}</p>
        ) : null}
      </div>
    </DraggableBottomSheet>
  );
}

function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    if (
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
