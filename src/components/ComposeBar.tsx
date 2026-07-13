"use client";

import { CalendarDays, Flag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import { getScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import type { QuickAddDraft } from "./QuickAddSheet";

type ComposeBarProps = {
  draft: QuickAddDraft;
  onOpenSchedule: () => void;
  onOpenPriority: () => void;
  // Called before the buttons steal focus so the parent can suppress the
  // ghost input's blur-to-commit while a date/priority editor is open.
  onSuppressCommit: () => void;
  // Extra root class, e.g. "isElevated" to raise the bar above an open bottom
  // sheet (used inside the task-detail sheet).
  className?: string;
};

// The slim bar pinned just above the keyboard while composing. It only edits the
// date/priority of the shared draft — the title lives in the ghost row (inbox
// top / subtask or day tail). There is no send button: committing happens on
// Enter (continue) or on blur (finish), handled by the ghost row.
export function ComposeBar({
  draft,
  onOpenSchedule,
  onOpenPriority,
  onSuppressCommit,
  className,
}: ComposeBarProps) {
  const { messages: text } = useLanguage();
  const priorityLabels = usePriorityLabels(getTranslatedPriorityLabels(text)).labels;

  const scheduleLabel = draft.dueDate
    ? getScheduleLabel(draft.dueDate, draft.dueTime, {
        locale: text.common.locale,
        noDateLabel: text.common.noDate,
      })
    : null;
  const priorityLabel =
    draft.priority !== "none" ? getPriorityLabel(draft.priority, priorityLabels) : null;

  return (
    <div className={className ? `composeBar ${className}` : "composeBar"} role="presentation">
      <div className="composeBarInner">
        <button
          className="quickAddDateButton"
          type="button"
          onPointerDown={onSuppressCommit}
          onClick={onOpenSchedule}
        >
          <CalendarDays size={18} aria-hidden="true" />
          {scheduleLabel ? <strong>{scheduleLabel}</strong> : <span>{text.common.date}</span>}
        </button>

        <button
          className="quickAddDateButton"
          type="button"
          onPointerDown={onSuppressCommit}
          onClick={onOpenPriority}
        >
          <Flag size={18} aria-hidden="true" />
          {priorityLabel ? (
            <strong className="priorityValue">
              <span
                className={`priorityDot ${getPriorityClass(draft.priority)}`}
                aria-hidden="true"
              />
              {priorityLabel}
            </strong>
          ) : (
            <span>{text.common.priority}</span>
          )}
        </button>
      </div>
    </div>
  );
}
