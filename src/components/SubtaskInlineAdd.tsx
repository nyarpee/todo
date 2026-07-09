"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import { ArrowUp, CalendarDays, Flag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import { getScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import type { TaskPriority } from "@/types/task";
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { ScheduleEditorSheet } from "./ScheduleEditorSheet";
import type { QuickAddDraft } from "./QuickAddSheet";

type SubtaskInlineAddProps = {
  placeholder: string;
  onAdd: (draft: QuickAddDraft) => void;
  onClose: () => void;
};

// An editable row that lives at the end of the subtask list. Each add inserts
// the new subtask above it, so this row is always right below the newest
// subtask — no overlays and no scroll math needed.
export function SubtaskInlineAdd({ placeholder, onAdd, onClose }: SubtaskInlineAddProps) {
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
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    onAdd({ title: title.trim(), dueDate, dueTime, priority });

    // Continuous add: clear for the next one and keep the keyboard up.
    setTitle("");
    setDueDate(null);
    setDueTime(null);
    setPriority("none");
    inputRef.current?.focus({ preventScroll: true });
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // Keep the row while a picker sheet is open (focus moves into its portal).
    if (isScheduleOpen || isPriorityOpen) return;
    // Ignore focus moves within the row (input -> date/priority/save buttons).
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    // Tapping elsewhere with nothing typed dismisses the row.
    if (title.trim().length === 0) onClose();
  }

  const scheduleLabel = dueDate
    ? getScheduleLabel(dueDate, dueTime, {
        locale: text.common.locale,
        noDateLabel: text.common.noDate,
      })
    : null;
  const priorityLabel = priority !== "none" ? getPriorityLabel(priority, labels) : null;

  return (
    <div className="subtaskInlineAdd" onBlur={handleBlur}>
      <form className="subtaskInlineAddForm" onSubmit={handleSubmit}>
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
    </div>
  );
}
