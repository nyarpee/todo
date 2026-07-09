"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { DEFAULT_MY_TASKS_GROUP_ID } from "@/lib/task-groups";
import type { TaskGroup, TaskGroupId } from "@/types/task";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

type GroupManagerSheetProps = {
  groups: TaskGroup[];
  taskCountByGroup: Record<TaskGroupId, number>;
  onRename: (groupId: TaskGroupId, name: string) => void;
  onDelete: (groupId: TaskGroupId) => void;
  onDismiss: () => void;
};

export function GroupManagerSheet({
  groups,
  taskCountByGroup,
  onRename,
  onDelete,
  onDismiss,
}: GroupManagerSheetProps) {
  const { messages: text } = useLanguage();
  const orderedGroups = useMemo(
    () =>
      groups
        .slice()
        .sort((first, second) => first.order - second.order || first.createdAt.localeCompare(second.createdAt)),
    [groups],
  );
  const [drafts, setDrafts] = useState<Record<TaskGroupId, string>>(() =>
    Object.fromEntries(groups.map((group) => [group.id, group.name])),
  );

  function draftFor(group: TaskGroup): string {
    return drafts[group.id] ?? group.name;
  }

  function commitRename(group: TaskGroup) {
    const next = draftFor(group).trim();
    if (next.length === 0) {
      // Restore the last saved name when the field is cleared.
      setDrafts((current) => ({ ...current, [group.id]: group.name }));
      return;
    }
    if (next === group.name) return;
    onRename(group.id, next);
  }

  function handleDelete(group: TaskGroup) {
    const taskCount = taskCountByGroup[group.id] ?? 0;
    const message =
      taskCount > 0
        ? text.lists.deleteWithTasks.replace("{count}", String(taskCount))
        : text.lists.deleteOne;
    if (window.confirm(message)) {
      onDelete(group.id);
    }
  }

  return (
    <DraggableBottomSheet
      ariaLabel={text.lists.menu}
      className="groupManagerSheet"
      dismissOnBackdrop
      onDismiss={onDismiss}
    >
      <h2 className="groupManagerTitle">{text.lists.menu}</h2>
      <ul className="groupManagerList">
        {orderedGroups.map((group) => {
          const isProtected = group.id === DEFAULT_MY_TASKS_GROUP_ID;
          return (
            <li className="groupManagerRow" key={group.id}>
              <input
                className="groupManagerInput"
                value={draftFor(group)}
                placeholder={text.lists.name}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [group.id]: event.target.value }))
                }
                onBlur={() => commitRename(group)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
              <button
                className="groupManagerDeleteButton"
                type="button"
                disabled={isProtected}
                aria-label={text.lists.delete}
                onClick={() => handleDelete(group)}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </DraggableBottomSheet>
  );
}
