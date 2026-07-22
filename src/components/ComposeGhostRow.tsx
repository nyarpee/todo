"use client";

import { useEffect, type KeyboardEvent, type RefObject } from "react";
import { CalendarDays } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import { getCompactScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import type { QuickAddDraft } from "./QuickAddSheet";

type ComposeGhostRowProps = {
  draft: QuickAddDraft;
  // The title field is a contenteditable div, NOT an <input>: iOS attaches its
  // prev/next/done keyboard assistant bar to focused form controls, and a
  // contenteditable is the one text-entry surface it leaves alone. Caret, IME
  // and the soft keyboard all behave the same.
  inputRef: RefObject<HTMLDivElement | null>;
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
    ? getCompactScheduleLabel(draft.dueDate, draft.dueTime, draft.scheduleType, text.common.locale)
    : null;
  const priorityLabel =
    draft.priority !== "none" ? getPriorityLabel(draft.priority, priorityLabels) : null;

  // One-way sync INTO the contenteditable: it owns the text while the user
  // types (onInput reports changes up), but external resets — committing a
  // task clears the draft to "" — must be pushed back down. Guarded so normal
  // typing never rewrites the DOM (which would throw away the caret position).
  useEffect(() => {
    const input = inputRef.current;
    if (input && (input.textContent ?? "") !== draft.title) {
      input.textContent = draft.title;
    }
  }, [draft.title, inputRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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
        <div
          ref={inputRef}
          className="composeGhostInput"
          contentEditable="plaintext-only"
          role="textbox"
          aria-label={text.common.addTask}
          data-placeholder={text.newTask}
          enterKeyHint="done"
          onInput={(event) => onChangeTitle(event.currentTarget.textContent ?? "")}
          onKeyDown={handleKeyDown}
          onBlur={onFinish}
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
