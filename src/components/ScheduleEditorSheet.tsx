"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  buildCalendarDays,
  fromDateKey,
  getMonthLabel,
  getScheduleLabel,
  getTodayKey,
  getTomorrowKey,
} from "@/lib/date-utils";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

type ScheduleEditorSheetProps = {
  title?: string;
  layerClassName?: string;
  dueDate: string | null;
  dueTime: string | null;
  onChange: (dueDate: string | null, dueTime: string | null) => void;
  onDismiss: () => boolean | void;
  onSave?: () => void;
  dateOnly?: boolean;
};

export function ScheduleEditorSheet({
  title,
  layerClassName,
  dueDate,
  dueTime,
  onChange,
  onDismiss,
  onSave,
  dateOnly = false,
}: ScheduleEditorSheetProps) {
  const { messages: text } = useLanguage();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    dueDate ? fromDateKey(dueDate) : new Date(),
  );
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  function handleSelectDate(date: string) {
    onChange(date, dueTime);
  }

  function handleClearDate() {
    onChange(null, null);
  }

  function handleTimeChange(value: string) {
    onChange(dueDate, value.length > 0 ? value : null);
  }

  function moveMonth(offset: number) {
    setVisibleMonth((currentMonth) => {
      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + offset);
      return nextMonth;
    });
  }

  return (
    <DraggableBottomSheet
      ariaLabel={text.common.date}
      className="scheduleSheet"
      layerClassName={layerClassName}
      dismissOnBackdrop
      onDismiss={onDismiss}
    >
        {title ? (
          <div className="scheduleSheetTitle">
            <span>{text.common.date}</span>
            <strong>{title}</strong>
          </div>
        ) : null}

        <div className="quickDateRow" aria-label={text.common.date}>
          <button
            className={dueDate === getTodayKey() ? "isSelected" : ""}
            type="button"
            onClick={() => handleSelectDate(getTodayKey())}
          >
            {text.common.today}
          </button>
          <button
            className={dueDate === getTomorrowKey() ? "isSelected" : ""}
            type="button"
            onClick={() => handleSelectDate(getTomorrowKey())}
          >
            {text.common.tomorrow}
          </button>
          {!dateOnly ? (
            <button className={dueDate === null ? "isSelected" : ""} type="button" onClick={handleClearDate}>
              {text.common.noneDate}
            </button>
          ) : null}
        </div>

        <div className="datePickerPanel">
          <div className="calendarHeader">
            <button type="button" aria-label={text.common.previousMonth} onClick={() => moveMonth(-1)}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <h2>{getMonthLabel(visibleMonth, text.common.locale)}</h2>
            <button type="button" aria-label={text.common.nextMonth} onClick={() => moveMonth(1)}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="calendarWeekdays" aria-hidden="true">
            {text.common.weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="calendarGrid">
            {calendarDays.map((day) => (
              <button
                className={[
                  "calendarDay",
                  day.isCurrentMonth ? "" : "isMuted",
                  day.isToday ? "isToday" : "",
                  day.date === dueDate ? "isSelected" : "",
                ].filter(Boolean).join(" ")}
                key={day.date}
                type="button"
                onClick={() => handleSelectDate(day.date)}
              >
                {day.dayOfMonth}
              </button>
            ))}
          </div>
        </div>

        {!dateOnly ? (
          <div className="timePanel">
            <label htmlFor="schedule-sheet-time">
              <CalendarClock size={16} aria-hidden="true" />
              {text.common.time}
            </label>
            <input
              id="schedule-sheet-time"
              type="time"
              value={dueTime ?? ""}
              disabled={!dueDate}
              onChange={(event) => handleTimeChange(event.target.value)}
            />
            <span>{getScheduleLabel(dueDate, dueTime, {
              locale: text.common.locale,
              noDateLabel: text.common.noDate,
            })}</span>
          </div>
        ) : null}

        {onSave ? (
          <button className="saveScheduleButton" type="button" onClick={onSave}>
            <Check size={18} aria-hidden="true" />
            {text.common.save}
          </button>
        ) : null}
    </DraggableBottomSheet>
  );
}
