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
import { createPortal } from "react-dom";
import { ArrowUp, CalendarDays, Flag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTranslatedPriorityLabels } from "@/i18n/priority-labels";
import { getScheduleLabel } from "@/lib/date-utils";
import { getPriorityClass, getPriorityLabel } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import type { TaskPriority } from "@/types/task";
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { ScheduleEditorSheet } from "./ScheduleEditorSheet";
import { TaskPathBreadcrumb, type PathCrumb } from "./TaskPathBreadcrumb";
import type { QuickAddDraft } from "./QuickAddSheet";

type SubtaskQuickAddSheetProps = {
  placeholder: string;
  crumbs: PathCrumb[];
  onNavigate: (taskId: string) => void;
  onAdd: (draft: QuickAddDraft) => void;
  onClose: () => void;
};

const BACKDROP_TAP_TOLERANCE_PX = 8;

// Floating composer pinned above the keyboard, styled like the inbox QuickAdd
// sheet. On the inbox the backdrop gets tap-to-close and swipe-to-scroll for
// free because the list scrolls the document itself (an ancestor of the
// backdrop). The detail view scrolls a nested sheet instead, which the browser
// will never reach from the backdrop, so we forward pan/wheel gestures on the
// backdrop to the detail sheet's scrollTop manually.
export function SubtaskQuickAddSheet({ placeholder, crumbs, onNavigate, onAdd, onClose }: SubtaskQuickAddSheetProps) {
  const { messages: text } = useLanguage();
  const [isMounted, setIsMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const translatedPriorityLabels = useMemo(() => getTranslatedPriorityLabels(text), [text]);
  const { labels } = usePriorityLabels(translatedPriorityLabels);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTouchYRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const canSave = title.trim().length > 0;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 80);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function getDetailSheet(): HTMLElement | null {
    return document.querySelector(".draggableSheet.detailSheet");
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

    const sheet = getDetailSheet();
    if (sheet) sheet.scrollTop += delta;
  }

  function handleBackdropWheel(event: ReactWheelEvent<HTMLButtonElement>) {
    const sheet = getDetailSheet();
    if (sheet) sheet.scrollTop += event.deltaY;
  }

  function handleBackdropClick() {
    // A swipe that scrolled the sheet must not also close the composer.
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    onAdd({ title: title.trim(), dueDate, dueTime, priority });

    // Continuous add: clear for the next subtask and keep the keyboard up.
    setTitle("");
    setDueDate(null);
    setDueTime(null);
    setPriority("none");
    inputRef.current?.focus({ preventScroll: true });
  }

  if (!isMounted) return null;

  const scheduleLabel = dueDate
    ? getScheduleLabel(dueDate, dueTime, {
        locale: text.common.locale,
        noDateLabel: text.common.noDate,
      })
    : null;
  const priorityLabel = priority !== "none" ? getPriorityLabel(priority, labels) : null;

  return createPortal(
    // React portals bubble synthetic events up the REACT tree, so without these
    // stops, backdrop swipes would also reach the detail DraggableBottomSheet's
    // drag handlers and pull the sheet closed. Blocking them here disables the
    // sheet's swipe-to-dismiss entirely while the composer is open.
    <div
      className="subtaskAddLayer"
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerCancel={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <button
        className="subtaskAddBackdrop"
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
        aria-label={text.taskDetail.addSubtask}
        onSubmit={handleSubmit}
      >
        <TaskPathBreadcrumb
          className="subtaskAddPath"
          crumbs={crumbs}
          ariaLabel={text.taskDetail.path}
          onNavigate={onNavigate}
        />
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
    </div>,
    document.body,
  );
}
