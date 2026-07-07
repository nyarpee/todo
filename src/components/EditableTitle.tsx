"use client";

import { KeyboardEvent, MouseEvent, useEffect, useRef, useState } from "react";

type EditableTitleProps = {
  value: string;
  className?: string;
  inputClassName?: string;
  title?: string;
  taskId?: string;
  autoEditTaskId?: string | null;
  editOnClick?: boolean;
  onAutoEditConsumed?: () => void;
  onClick?: () => void;
  onSave: (value: string) => void;
};

export function EditableTitle({
  value,
  className,
  inputClassName,
  title,
  taskId,
  autoEditTaskId,
  editOnClick = false,
  onAutoEditConsumed,
  onClick,
  onSave,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing, value]);

  useEffect(() => {
    if (!taskId || autoEditTaskId !== taskId) return;

    setIsEditing(true);
    onAutoEditConsumed?.();
  }, [autoEditTaskId, onAutoEditConsumed, taskId]);

  useEffect(() => clearClickTimer, []);

  function save() {
    const nextValue = draft.trim();

    if (nextValue.length > 0 && nextValue !== value) {
      onSave(nextValue);
    }

    setIsEditing(false);
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  function clearClickTimer() {
    if (clickTimerRef.current === null) return;
    window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
  }

  function handleClick() {
    if (editOnClick) {
      setIsEditing(true);
      return;
    }

    if (!onClick) return;

    clearClickTimer();
    clickTimerRef.current = window.setTimeout(() => {
      onClick();
      clickTimerRef.current = null;
    }, 180);
  }

  function handleDoubleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    clearClickTimer();
    setIsEditing(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className={inputClassName ?? className}
        value={draft}
        onBlur={save}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Edit task title"
      />
    );
  }

  return (
    <button
      className={className}
      type="button"
      title={title ?? value}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {value}
    </button>
  );
}
