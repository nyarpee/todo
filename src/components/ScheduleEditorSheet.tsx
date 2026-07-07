"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildCalendarDays,
  fromDateKey,
  getEndOfWeekKey,
  getMonthLabel,
  getScheduleLabel,
  getTodayKey,
  getTomorrowKey,
} from "@/lib/date-utils";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

type ScheduleEditorSheetProps = {
  title?: string;
  dueDate: string | null;
  dueTime: string | null;
  onChange: (dueDate: string | null, dueTime: string | null) => void;
  onDismiss: () => boolean | void;
  onSave?: () => void;
};

export function ScheduleEditorSheet({
  title,
  dueDate,
  dueTime,
  onChange,
  onDismiss,
  onSave,
}: ScheduleEditorSheetProps) {
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
      ariaLabel="Edit date"
      className="scheduleSheet"
      onDismiss={onDismiss}
    >
        {title ? (
          <div className="scheduleSheetTitle">
            <span>Date</span>
            <strong>{title}</strong>
          </div>
        ) : null}

        <div className="quickDateRow" aria-label="Quick date choices">
          <button
            className={dueDate === getTodayKey() ? "isSelected" : ""}
            type="button"
            onClick={() => handleSelectDate(getTodayKey())}
          >
            Today
          </button>
          <button
            className={dueDate === getTomorrowKey() ? "isSelected" : ""}
            type="button"
            onClick={() => handleSelectDate(getTomorrowKey())}
          >
            Tomorrow
          </button>
          <button
            className={dueDate === getEndOfWeekKey() ? "isSelected" : ""}
            type="button"
            onClick={() => handleSelectDate(getEndOfWeekKey())}
          >
            This week
          </button>
          <button className={dueDate === null ? "isSelected" : ""} type="button" onClick={handleClearDate}>
            None date
          </button>
        </div>

        <div className="datePickerPanel">
          <div className="calendarHeader">
            <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <h2>{getMonthLabel(visibleMonth)}</h2>
            <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="calendarWeekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
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

        <div className="timePanel">
          <label htmlFor="schedule-sheet-time">
            <CalendarClock size={16} aria-hidden="true" />
            Time
          </label>
          <input
            id="schedule-sheet-time"
            type="time"
            value={dueTime ?? ""}
            disabled={!dueDate}
            onChange={(event) => handleTimeChange(event.target.value)}
          />
          <span>{getScheduleLabel(dueDate, dueTime)}</span>
        </div>

        {onSave ? (
          <button className="saveScheduleButton" type="button" onClick={onSave}>
            <Check size={18} aria-hidden="true" />
            Save
          </button>
        ) : null}
    </DraggableBottomSheet>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
