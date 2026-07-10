"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, CalendarDays, Flag, Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
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
  initialDueDate?: string | null;
  anchorTop?: number | null;
};

export function FloatingAddButton({ onClick }: { onClick: () => void }) {
  const { messages: text } = useLanguage();

  return (
    <button className="floatingAddButton" type="button" onClick={onClick} aria-label={text.common.addTask}>
      <Plus size={26} aria-hidden="true" />
    </button>
  );
}

export function QuickAddSheet({ isOpen, onClose, onSave, initialDueDate = null, anchorTop = null }: QuickAddSheetProps) {
  const { messages: text } = useLanguage();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const translatedPriorityLabels = useMemo(() => getTranslatedPriorityLabels(text), [text]);
  const { labels } = usePriorityLabels(translatedPriorityLabels);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const canSave = title.trim().length > 0;

  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = window.setTimeout(() => {
      titleInputRef.current?.focus({ preventScroll: true });
    }, 80);

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

  useEffect(() => {
    if (!isOpen) return;
    setDueDate(initialDueDate ?? null);
  }, [isOpen, initialDueDate]);

  if (!isOpen) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    onSave({
      title: title.trim(),
      dueDate,
      dueTime,
      priority,
    });
  }

  const scheduleLabel = dueDate
    ? getScheduleLabel(dueDate, dueTime, {
        locale: text.common.locale,
        noDateLabel: text.common.noDate,
      })
    : null;
  const priorityLabel = priority !== "none" ? getPriorityLabel(priority, labels) : null;

  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const anchoredTop =
    anchorTop !== null && viewportHeight > 0
      ? Math.max(12, Math.min(anchorTop + 6, viewportHeight * 0.5))
      : null;

  return (
    <div className={anchoredTop !== null ? "quickAddLayer isAnchored" : "quickAddLayer"} role="presentation">
      <button className="quickAddBackdrop" type="button" aria-label={text.common.close} onClick={onClose} />
      <form
        className="quickAddSheet"
        role="dialog"
        aria-modal="true"
        aria-label={text.common.addTask}
        onSubmit={handleSubmit}
        style={anchoredTop !== null ? { marginTop: `${Math.round(anchoredTop)}px` } : undefined}
      >
        <div className="quickAddTitleRow">
          <input
            id="quick-add-task-title"
            ref={titleInputRef}
            className="quickAddTitleInput"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={text.common.title}
          />
          <button className="quickAddInlineSaveButton" type="submit" disabled={!canSave} aria-label={text.common.save}>
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
    </div>
  );
}
