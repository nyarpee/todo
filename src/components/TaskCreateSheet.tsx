"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Flag, Save } from "lucide-react";
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
};

export function TaskCreateSheet({
  ariaLabel,
  placeholder,
  onDismiss,
  onSave,
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
  const canSave = title.trim().length > 0;

  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(focusTimer);
  }, []);

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
    <DraggableBottomSheet
      ariaLabel={ariaLabel}
      className="createTaskSheet"
      dismissOnBackdrop
      showHandle={false}
      onDismiss={onDismiss}
    >
      <form className="createTaskForm" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="quickAddTitleInput"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={placeholder}
        />
        <div className="quickAddMetaRow">
          <button className="quickAddDateButton" type="button" onClick={() => setIsScheduleOpen(true)}>
            <CalendarDays size={18} aria-hidden="true" />
            <span>{text.common.date}</span>
            <strong>{getScheduleLabel(dueDate, dueTime, {
              locale: text.common.locale,
              noDateLabel: text.common.noDate,
            })}</strong>
          </button>
          <button className="quickAddDateButton" type="button" onClick={() => setIsPriorityOpen(true)}>
            <Flag size={18} aria-hidden="true" />
            <span>{text.common.priority}</span>
            <strong className="priorityValue">
              <span className={`priorityDot ${getPriorityClass(priority)}`} aria-hidden="true" />
              {getPriorityLabel(priority, labels)}
            </strong>
          </button>
        </div>
        <button
          className="quickAddSaveButton"
          type="submit"
          disabled={!canSave}
          aria-label={text.common.save}
        >
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
    </DraggableBottomSheet>
  );
}
