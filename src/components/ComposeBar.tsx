"use client";

import { ArrowLeft, CalendarDays, ChevronRight, Flag, MapPin } from "lucide-react";
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
  onSuppressCommit: () => void;
  onFinish: () => void;
  className?: string;
  groupLabel?: string;
  onOpenGroup?: () => void;
};

export function ComposeBar({
  draft,
  onOpenSchedule,
  onOpenPriority,
  onSuppressCommit,
  onFinish,
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
        <div className="composeBarHeader">
          <button
            className="composeBarCloseButton"
            type="button"
            aria-label={text.common.back}
            title={text.common.back}
            onPointerDown={(event) => event.preventDefault()}
            onClick={onFinish}
          >
            <ArrowLeft size={19} aria-hidden="true" />
          </button>
          {onOpenGroup ? (
            <button
              className="composeBarLocation"
              type="button"
              onPointerDown={onSuppressCommit}
              onClick={onOpenGroup}
            >
              <MapPin size={15} aria-hidden="true" />
              <span className="composeBarLocationPath">
                <span>{groupLabel || text.lists.area}</span>
              </span>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>

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
