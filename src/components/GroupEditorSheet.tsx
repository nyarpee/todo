"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { TaskGroup } from "@/types/task";
import { DEFAULT_MY_TASKS_GROUP_ID } from "@/lib/task-groups";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

type GroupEditorSheetProps =
  | {
      mode: "create";
      onDismiss: () => void;
      onSave: (name: string) => void;
    }
  | {
      mode: "menu";
      group: TaskGroup;
      taskCount: number;
      onDismiss: () => void;
      onRename: (name: string) => void;
      onDelete: () => void;
    };

export function GroupEditorSheet(props: GroupEditorSheetProps) {
  const [name, setName] = useState(props.mode === "menu" ? props.group.name : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const canSave = name.trim().length > 0;

  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(focusTimer);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    if (props.mode === "create") {
      props.onSave(name.trim());
      return;
    }

    props.onRename(name.trim());
  }

  function handleDelete() {
    if (props.mode !== "menu") return;

    const message =
      props.taskCount > 0
        ? `This list has ${props.taskCount} tasks. Delete the list and all tasks?`
        : "Delete this list?";

    if (window.confirm(message)) {
      props.onDelete();
    }
  }

  const isProtected = props.mode === "menu" && props.group.id === DEFAULT_MY_TASKS_GROUP_ID;

  return (
    <DraggableBottomSheet
      ariaLabel={props.mode === "create" ? "Add list" : "List menu"}
      className="groupEditorSheet"
      dismissOnBackdrop
      showHandle={false}
      onDismiss={props.onDismiss}
    >
      <form className="groupEditorForm" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="quickAddTitleInput"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="List name"
        />
        <button className="groupEditorSaveButton" type="submit" disabled={!canSave}>
          {props.mode === "create" ? "Add list" : "Rename list"}
        </button>
      </form>
      {props.mode === "menu" ? (
        <button
          className="groupDeleteButton"
          type="button"
          disabled={isProtected}
          onClick={handleDelete}
        >
          Delete list
        </button>
      ) : null}
    </DraggableBottomSheet>
  );
}
