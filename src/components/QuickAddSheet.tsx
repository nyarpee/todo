"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
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
  keepOpenOnSave?: boolean;
  transparentBackdrop?: boolean;
  /**
   * CSS selector for the element that scrolls behind the sheet (e.g. the
   * calendar day list). When omitted the document itself is scrolled. Backdrop
   * pans/wheel are forwarded to it in JS so the background never scrolls
   * natively — that native scroll is what makes iOS re-lay-out the fixed sheet
   * and wobble. See SubtaskQuickAddSheet for the same technique.
   */
  scrollSelector?: string;
};

const BACKDROP_TAP_TOLERANCE_PX = 8;

export function FloatingAddButton({ onClick }: { onClick: () => void }) {
  const { messages: text } = useLanguage();

  return (
    <button className="floatingAddButton" type="button" onClick={onClick} aria-label={text.common.addTask}>
      <Plus size={26} aria-hidden="true" />
    </button>
  );
}

export function QuickAddSheet({
  isOpen,
  onClose,
  onSave,
  initialDueDate = null,
  keepOpenOnSave = false,
  transparentBackdrop = false,
  scrollSelector,
}: QuickAddSheetProps) {
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
  const lastTouchYRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const canSave = title.trim().length > 0;

  function getScroller(): HTMLElement | null {
    if (scrollSelector) {
      const el = document.querySelector<HTMLElement>(scrollSelector);
      if (el) return el;
    }
    return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
  }

  function handleBackdropTouchStart(event: ReactTouchEvent<HTMLButtonElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    lastTouchYRef.current = touch.clientY;
    touchStartYRef.current = touch.clientY;
    didDragRef.current = false;
  }

  function handleBackdropTouchMove(event: ReactTouchEvent<HTMLButtonElement>) {
    const touch = event.touches[0];
    if (!touch || lastTouchYRef.current === null) return;

    const delta = lastTouchYRef.current - touch.clientY;
    lastTouchYRef.current = touch.clientY;

    if (
      touchStartYRef.current !== null &&
      Math.abs(touch.clientY - touchStartYRef.current) > BACKDROP_TAP_TOLERANCE_PX
    ) {
      didDragRef.current = true;
    }

    const scroller = getScroller();
    if (scroller) scroller.scrollTop += delta;
  }

  function handleBackdropWheel(event: ReactWheelEvent<HTMLButtonElement>) {
    const scroller = getScroller();
    if (scroller) scroller.scrollTop += event.deltaY;
  }

  function handleBackdropClick() {
    // A swipe that scrolled the background must not also close the sheet.
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onClose();
  }

  useEffect(() => {
    if (!isOpen) return;

    // Focus synchronously on mount. iOS keeps the keyboard up because the
    // opening tap already primed it via primeKeyboard(); this just transfers
    // focus from the hidden proxy input to the real one.
    titleInputRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
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

    if (keepOpenOnSave) {
      // Compose mode: add and stay open for the next task, keeping the keyboard up.
      onSave({ title: title.trim(), dueDate, dueTime, priority });
      setTitle("");
      setDueTime(null);
      setPriority("none");
      titleInputRef.current?.focus({ preventScroll: true });
      return;
    }

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

  return (
    <div className="quickAddLayer" role="presentation">
      <button
        className={transparentBackdrop ? "sheetBackdrop" : "quickAddBackdrop"}
        type="button"
        aria-label={text.common.close}
        onClick={handleBackdropClick}
        onTouchStart={handleBackdropTouchStart}
        onTouchMove={handleBackdropTouchMove}
        onWheel={handleBackdropWheel}
      />
      <form
        className="quickAddSheet"
        role="dialog"
        aria-modal="true"
        aria-label={text.common.addTask}
        onSubmit={handleSubmit}
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
