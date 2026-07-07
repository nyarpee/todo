"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CalendarDays, Flag, Plus, Save } from "lucide-react";
import { getScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import type { TaskPriority } from "@/types/task";
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { ScheduleEditorSheet } from "./ScheduleEditorSheet";

export type QuickAddDraft = {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: TaskPriority;
};

type QuickAddSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: QuickAddDraft) => void;
};

export function FloatingAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="floatingAddButton" type="button" onClick={onClick} aria-label="Add task">
      <Plus size={26} aria-hidden="true" />
    </button>
  );
}

export function QuickAddSheet({ isOpen, onClose, onSave }: QuickAddSheetProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const { labels } = usePriorityLabels();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const canSave = title.trim().length > 0;

  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = window.setTimeout(() => titleInputRef.current?.focus(), 80);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;

    setTitle("");
    setDueDate(null);
    setDueTime(null);
    setPriority("none");
    setIsScheduleOpen(false);
    setIsPriorityOpen(false);
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    onSave({
      title: title.trim(),
      dueDate,
      dueTime,
      priority,
    });
  }

  return (
    <div className="quickAddLayer" role="presentation">
      <button className="quickAddBackdrop" type="button" aria-label="Close add task" onClick={onClose} />
      <form
        className="quickAddSheet"
        role="dialog"
        aria-modal="true"
        aria-label="Add task"
        onSubmit={handleSubmit}
      >
        <input
          id="quick-add-task-title"
          ref={titleInputRef}
          className="quickAddTitleInput"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
        />

        <div className="quickAddMetaRow">
          <button className="quickAddDateButton" type="button" onClick={() => setIsScheduleOpen(true)}>
            <CalendarDays size={18} aria-hidden="true" />
            <span>Date</span>
            <strong>{getScheduleLabel(dueDate, dueTime)}</strong>
          </button>

          <button className="quickAddDateButton" type="button" onClick={() => setIsPriorityOpen(true)}>
            <Flag size={18} aria-hidden="true" />
            <span>Priority</span>
            <strong className="priorityValue">
              <span className={`priorityDot ${getPriorityClass(priority)}`} aria-hidden="true" />
              {getPriorityLabel(priority, labels)}
            </strong>
          </button>
        </div>

        <button className="quickAddSaveButton" type="submit" disabled={!canSave} aria-label="Save task">
          <Save size={20} aria-hidden="true" />
        </button>
      </form>
      {isScheduleOpen ? (
        <ScheduleEditorSheet
          dueDate={dueDate}
          dueTime={dueTime}
          onChange={(nextDueDate, nextDueTime) => {
            setDueDate(nextDueDate);
            setDueTime(nextDueTime);
          }}
          onDismiss={() => setIsScheduleOpen(false)}
        />
      ) : null}
      {isPriorityOpen ? (
        <PriorityEditorSheet
          value={priority}
          onChange={setPriority}
          onDismiss={() => setIsPriorityOpen(false)}
        />
      ) : null}
    </div>
  );
}
