"use client";

import { CalendarDays, ChevronRight, Flag, MapPin } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import { getCompactScheduleLabel } from "@/lib/date-utils";
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
  // sheet (used while the task-detail sheet is open).
  className?: string;
  // Optional destination strip (inbox/detail/calendar; omitted when the
  // composer has no movable target). Shown as its own full-width row above the
  // attribute chips: the location is where the task lands — context, not an
  // attribute — so it gets a different shape and its own line for the path.
  groupLabel?: string;
  onOpenGroup?: () => void;
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
  groupLabel,
  onOpenGroup,
}: ComposeBarProps) {
  const { messages: text } = useLanguage();
  const priorityLabels = usePriorityLabels(getTranslatedPriorityLabels(text)).labels;

  const scheduleLabel = draft.dueDate
    ? getCompactScheduleLabel(draft.dueDate, draft.dueTime, draft.scheduleType, text.common.locale)
    : null;
  const priorityLabel =
    draft.priority !== "none" ? getPriorityLabel(draft.priority, priorityLabels) : null;

  return (
    <div className={className ? `composeBar ${className}` : "composeBar"} role="presentation">
      <div className="composeBarInner">
        {onOpenGroup ? (
          <button
            className="composeBarLocation"
            type="button"
            onPointerDown={onSuppressCommit}
            onClick={onOpenGroup}
          >
            <MapPin size={15} aria-hidden="true" />
            {/* The path clips from the LEFT when it overflows, so the tail —
                the actual destination — always stays visible. */}
            <span className="composeBarLocationPath">
              <span>{groupLabel || text.lists.area}</span>
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        ) : null}

        <div className="composeBarActions">
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
    </div>
  );
}
