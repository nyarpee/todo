"use client";

import { useState } from "react";
import { CalendarDays, ChevronRight, Flag, MapPin } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import { getScheduleLabel, getTodayKey, getTomorrowKey } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import type { QuickAddDraft } from "./QuickAddSheet";

type ComposeBarProps = {
  draft: QuickAddDraft;
  // Opens the full calendar sheet for fine date/time control.
  onOpenSchedule: () => void;
  onOpenPriority: () => void;
  // Applies a one-tap date inline (no sheet). null clears the date.
  onSelectQuickDate: (dueDate: string | null, dueTime: string | null) => void;
  // Called before the buttons steal focus so the parent can suppress the
  // ghost input's blur-to-commit while an editor/inline picker is open.
  onSuppressCommit: () => void;
  // Re-focus the ghost input and clear the suppression after an inline
  // interaction ends, so composing continues with the keyboard up.
  onResumeCompose?: () => void;
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
  onSelectQuickDate,
  onSuppressCommit,
  onResumeCompose,
  className,
  groupLabel,
  onOpenGroup,
}: ComposeBarProps) {
  const { messages: text } = useLanguage();
  const priorityLabels = usePriorityLabels(getTranslatedPriorityLabels(text)).labels;
  // When true the bottom row becomes an inline date picker instead of the two
  // attribute chips — the common quick dates without leaving the keyboard.
  const [isDateExpanded, setIsDateExpanded] = useState(false);

  const scheduleLabel = draft.dueDate
    ? getScheduleLabel(draft.dueDate, draft.dueTime, {
        locale: text.common.locale,
        noDateLabel: text.common.noDate,
      })
    : null;
  const priorityLabel =
    draft.priority !== "none" ? getPriorityLabel(draft.priority, priorityLabels) : null;

  const todayKey = getTodayKey();
  const tomorrowKey = getTomorrowKey();

  // Apply a quick date, fold the row back, and hand focus to the ghost input.
  function pickQuickDate(dueDate: string | null, dueTime: string | null) {
    onSelectQuickDate(dueDate, dueTime);
    setIsDateExpanded(false);
    onResumeCompose?.();
  }

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

        {isDateExpanded ? (
          <div className="composeBarDateRow">
            {/* The leading calendar icon doubles as the collapse control. */}
            <button
              className="composeDateCollapse"
              type="button"
              aria-label={text.common.date}
              onPointerDown={onSuppressCommit}
              onClick={() => {
                setIsDateExpanded(false);
                onResumeCompose?.();
              }}
            >
              <CalendarDays size={18} aria-hidden="true" />
            </button>
            <button
              className={draft.dueDate === todayKey ? "composeDateQuick isSelected" : "composeDateQuick"}
              type="button"
              onPointerDown={onSuppressCommit}
              onClick={() => pickQuickDate(todayKey, draft.dueTime)}
            >
              {text.common.today}
            </button>
            <button
              className={draft.dueDate === tomorrowKey ? "composeDateQuick isSelected" : "composeDateQuick"}
              type="button"
              onPointerDown={onSuppressCommit}
              onClick={() => pickQuickDate(tomorrowKey, draft.dueTime)}
            >
              {text.common.tomorrow}
            </button>
            <button
              className={draft.dueDate === null ? "composeDateQuick isSelected" : "composeDateQuick"}
              type="button"
              onPointerDown={onSuppressCommit}
              onClick={() => pickQuickDate(null, null)}
            >
              {text.common.noneDate}
            </button>
            <button
              className="composeDateQuick isCalendar"
              type="button"
              onPointerDown={onSuppressCommit}
              onClick={() => {
                setIsDateExpanded(false);
                onOpenSchedule();
              }}
            >
              {text.common.calendar}
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="composeBarActions">
            <button
              className="quickAddDateButton"
              type="button"
              onPointerDown={onSuppressCommit}
              onClick={() => setIsDateExpanded(true)}
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
        )}
      </div>
    </div>
  );
}
