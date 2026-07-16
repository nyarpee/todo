"use client";

import type { KeyboardEvent, RefObject } from "react";
import { CalendarDays } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import { getScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import type { QuickAddDraft } from "./QuickAddSheet";

type ComposeGhostRowProps = {
  draft: QuickAddDraft;
  inputRef: RefObject<HTMLInputElement | null>;
  // Enter: save the current title and keep composing (a fresh ghost row).
  onSubmit: () => void;
  // Blur (keyboard dismissed): save if non-empty, otherwise discard, then close.
  onFinish: () => void;
  onChangeTitle: (title: string) => void;
  locationLabel?: string;
};

// The faint "ghost" row shown where a new task will land while composing (top of
// the inbox list, or the tail of a subtask/day group). Its input is the single
// source of truth for the new task's title; the slim compose bar edits the same
// draft's date/priority. Styled dimly to read as "this is about to be added here".
export function ComposeGhostRow({
  draft,
  inputRef,
  onSubmit,
  onFinish,
  onChangeTitle,
  locationLabel,
}: ComposeGhostRowProps) {
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

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="composeGhostRow" role="group" aria-label={text.common.addTask}>
      <span className="composeGhostCheck" aria-hidden="true" />
      <div className="composeGhostContent">
        {locationLabel ? <span className="composeGhostLocation">{locationLabel} &gt;</span> : null}
        <input
          ref={inputRef}
          className="composeGhostInput"
          value={draft.title}
          onChange={(event) => onChangeTitle(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onFinish}
          placeholder={text.newTask}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {scheduleLabel || priorityLabel ? (
          <div className="composeGhostMeta">
            {scheduleLabel ? (
              <span className="composeGhostChip">
                <CalendarDays size={13} aria-hidden="true" />
                {scheduleLabel}
              </span>
            ) : null}
            {priorityLabel ? (
              <span className="composeGhostChip">
                <span
                  className={`priorityDot ${getPriorityClass(draft.priority)}`}
                  aria-hidden="true"
                />
                {priorityLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
