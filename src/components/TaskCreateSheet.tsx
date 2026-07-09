"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, CalendarDays, Flag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import { getScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import type { TaskPriority } from "@/types/task";
import { DraggableBottomSheet } from "./DraggableBottomSheet";
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { ScheduleEditorSheet } from "./ScheduleEditorSheet";
import type { QuickAddDraft } from "./QuickAddSheet";

type TaskCreateSheetProps = {
  ariaLabel: string;
  placeholder: string;
  onDismiss: () => void;
  onSave: (draft: QuickAddDraft) => void;
  // When true, the sheet stays open after saving (clears + refocuses) so several
  // subtasks can be added in a row while the list behind stays visible.
  persist?: boolean;
  onSaved?: () => void;
};

export function TaskCreateSheet({
  ariaLabel,
  placeholder,
  onDismiss,
  onSave,
  persist = false,
  onSaved,
}: TaskCreateSheetProps) {
  const { messages: text } = useLanguage();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const translatedPriorityLabels = useMemo(() => getTranslatedPriorityLabels(text), [text]);
  const { labels } = usePriorityLabels(translatedPriorityLabels);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const canSave = title.trim().length > 0;

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, []);

  // Publish the composer's height so the detail view can reserve room below the
  // subtask list and keep the newest subtask visible just above the composer.
  useEffect(() => {
    if (!persist) return;
    const form = formRef.current;
    const sheet = (form?.closest(".draggableSheet") as HTMLElement | null) ?? form;
    if (!sheet) return;

    const publishHeight = () => {
      document.documentElement.style.setProperty(
        "--subtask-composer-height",
        `${Math.round(sheet.getBoundingClientRect().height)}px`,
      );
    };
    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(sheet);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty("--subtask-composer-height", "0px");
    };
  }, [persist]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    onSave({
      title: title.trim(),
      dueDate,
      dueTime,
      priority,
    });

    if (persist) {
      // Reset for the next subtask and keep the keyboard up by staying focused.
      setTitle("");
      setDueDate(null);
      setDueTime(null);
      setPriority("none");
      inputRef.current?.focus({ preventScroll: true });
      onSaved?.();
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  const scheduleLabel = dueDate
    ? getScheduleLabel(dueDate, dueTime, {
        locale: text.common.locale,
        noDateLabel: text.common.noDate,
      })
    : null;
  const priorityLabel = priority !== "none" ? getPriorityLabel(priority, labels) : null;

  return (
    <DraggableBottomSheet
      ariaLabel={ariaLabel}
      className={persist ? "createTaskSheet createTaskSheetPersist" : "createTaskSheet"}
      dismissOnBackdrop
      showHandle={false}
      bareLayer={persist}
      onDismiss={onDismiss}
    >
      <form ref={formRef} className="createTaskForm" onSubmit={handleSubmit}>
        <div className="quickAddTitleRow">
          <input
            ref={inputRef}
            className="quickAddTitleInput"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={placeholder}
          />
          <button
            className="quickAddInlineSaveButton"
            type="submit"
            disabled={!canSave}
            aria-label={text.common.save}
          >
            <ArrowUp size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="quickAddMetaRow">
          <button className="quickAddDateButton" type="button" onClick={() => setIsScheduleOpen(true)}>
            <CalendarDays size={18} aria-hidden="true" />
            {scheduleLabel ? <strong>{scheduleLabel}</strong> : <span>{text.common.date}</span>}
          </button>
          <button className="quickAddDateButton" type="button" onClick={() => setIsPriorityOpen(true)}>
            <Flag size={18} aria-hidden="true" />
            {priorityLabel ? (
              <strong className="priorityValue">
                <span className={`priorityDot ${getPriorityClass(priority)}`} aria-hidden="true" />
                {priorityLabel}
              </strong>
            ) : (
              <span>{text.common.priority}</span>
            )}
          </button>
        </div>
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
    </DraggableBottomSheet>
  );
}
