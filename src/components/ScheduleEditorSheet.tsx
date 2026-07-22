"use client";

import { useMemo, useState, type UIEvent } from "react";
import { CalendarDays, Check, Clock3, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { addDays, fromDateKey, getTodayKey, toDateKey } from "@/lib/date-utils";
import type { TaskScheduleType } from "@/types/task";
import type { AppLanguage } from "@/types/user-settings";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

type ScheduleEditorSheetProps = {
  title?: string;
  layerClassName?: string;
  dueDate: string | null;
  dueTime: string | null;
  scheduleType?: TaskScheduleType;
  onChange: (dueDate: string | null, dueTime: string | null, scheduleType: TaskScheduleType) => void;
  onDismiss: () => boolean | void;
  onSave?: () => void;
  dateOnly?: boolean;
};

type OpenEditor = "date" | "time" | null;

const COPY: Record<AppLanguage, {
  noSchedule: string;
  addDate: string;
  changeDate: string;
  addTime: string;
  changeTime: string;
  removeDate: string;
  removeTime: string;
  scheduled: string;
  deadline: string;
  scheduledHelp: string;
  deadlineHelp: string;
  apply: string;
}> = {
  en: {
    noSchedule: "No schedule",
    addDate: "Add date",
    changeDate: "Change date",
    addTime: "Add time",
    changeTime: "Change time",
    removeDate: "Remove date",
    removeTime: "Remove time",
    scheduled: "on",
    deadline: "by",
    scheduledHelp: "Do it on this date",
    deadlineHelp: "Finish it by this date",
    apply: "Set schedule",
  },
  ja: {
    noSchedule: "日程は設定されていません",
    addDate: "日付を追加",
    changeDate: "日付を変更",
    addTime: "時刻を追加",
    changeTime: "時刻を変更",
    removeDate: "日付を解除",
    removeTime: "時刻を解除",
    scheduled: "に",
    deadline: "までに",
    scheduledHelp: "その日にやる（予定日）",
    deadlineHelp: "その日までにやる（期限）",
    apply: "設定する",
  },
  "zh-CN": {
    noSchedule: "未设置日程",
    addDate: "添加日期",
    changeDate: "更改日期",
    addTime: "添加时间",
    changeTime: "更改时间",
    removeDate: "移除日期",
    removeTime: "移除时间",
    scheduled: "当天进行",
    deadline: "此前完成",
    scheduledHelp: "在当天进行（计划日期）",
    deadlineHelp: "在此日期前完成（截止日期）",
    apply: "设置日程",
  },
  "zh-TW": {
    noSchedule: "尚未設定日程",
    addDate: "新增日期",
    changeDate: "變更日期",
    addTime: "新增時間",
    changeTime: "變更時間",
    removeDate: "移除日期",
    removeTime: "移除時間",
    scheduled: "當天進行",
    deadline: "在此之前完成",
    scheduledHelp: "在當天進行（預定日期）",
    deadlineHelp: "在此日期前完成（截止日期）",
    apply: "設定日程",
  },
};

export function ScheduleEditorSheet({
  title,
  layerClassName,
  dueDate,
  dueTime,
  scheduleType = "deadline",
  onChange,
  onDismiss,
  onSave,
  dateOnly = false,
}: ScheduleEditorSheetProps) {
  const { language, messages: text } = useLanguage();
  const copy = COPY[language];
  const [openEditor, setOpenEditor] = useState<OpenEditor>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [weekCount, setWeekCount] = useState(16);
  const todayKey = getTodayKey();
  const weekDays = useMemo(() => buildForwardWeekDays(weekCount, language), [language, weekCount]);

  function selectDate(date: string) {
    onChange(date, dueTime, scheduleType);
    setOpenEditor(null);
  }

  function removeDate() {
    onChange(null, null, scheduleType);
    setOpenEditor(null);
  }

  function openTimeEditor() {
    if (!dueDate) {
      setOpenEditor("date");
      return;
    }
    setOpenEditor((current) => current === "time" ? null : "time");
  }

  function handleCalendarScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 180) {
      setWeekCount((count) => count + 12);
    }
  }

  return (
    <DraggableBottomSheet
      ariaLabel={text.common.date}
      className="scheduleSheet"
      {...(layerClassName ? { layerClassName } : {})}
      dismissOnBackdrop
      onDismiss={onDismiss}
    >
      {title ? (
        <div className="scheduleSheetTitle">
          <span>{text.common.date}</span>
          <strong>{title}</strong>
        </div>
      ) : null}

      <section className="scheduleSummary" aria-live="polite">
        {dueDate ? (
          <div className="scheduleSentence">
            {language === "en" ? <span>{scheduleType === "deadline" ? "Finish it" : "Do it"}</span> : null}
            {language === "en" ? (
              <button className="scheduleRelation" type="button" onClick={() => setShowTypeMenu((visible) => !visible)}>
                {scheduleType === "deadline" ? copy.deadline : copy.scheduled}
              </button>
            ) : null}
            <button type="button" onClick={() => setOpenEditor("date")}>
              {formatScheduleDate(dueDate, language)}
            </button>
            {dueTime ? (
              <button type="button" onClick={openTimeEditor}>{language === "en" ? "at " : ""}{formatScheduleTime(dueTime, language)}</button>
            ) : null}
            {language !== "en" ? (
              <button className="scheduleRelation" type="button" onClick={() => setShowTypeMenu((visible) => !visible)}>
                {scheduleType === "deadline" ? copy.deadline : copy.scheduled}
              </button>
            ) : null}
            {language === "ja" ? <span>やる</span> : null}
          </div>
        ) : (
          <p className="scheduleEmptySentence">{copy.noSchedule}</p>
        )}

        {showTypeMenu && dueDate ? (
          <div className="scheduleTypeMenu">
            <button className={scheduleType === "scheduled" ? "isSelected" : ""} type="button" onClick={() => { onChange(dueDate, dueTime, "scheduled"); setShowTypeMenu(false); }}>
              {copy.scheduledHelp}
            </button>
            <button className={scheduleType === "deadline" ? "isSelected" : ""} type="button" onClick={() => { onChange(dueDate, dueTime, "deadline"); setShowTypeMenu(false); }}>
              {copy.deadlineHelp}
            </button>
          </div>
        ) : null}
      </section>

      <div className="scheduleActions">
        <div className="scheduleActionLine">
          <button type="button" onClick={() => setOpenEditor((current) => current === "date" ? null : "date")}>
            <CalendarDays size={18} aria-hidden="true" />
            <span>{dueDate ? copy.changeDate : copy.addDate}</span>
          </button>
          {dueDate ? <button className="scheduleRemove" type="button" aria-label={copy.removeDate} onClick={removeDate}><X size={17} /></button> : null}
        </div>
        {!dateOnly && dueDate ? (
          <div className="scheduleActionLine">
            <button type="button" onClick={openTimeEditor}>
              <Clock3 size={18} aria-hidden="true" />
              <span>{dueTime ? copy.changeTime : copy.addTime}</span>
            </button>
            {dueTime ? <button className="scheduleRemove" type="button" aria-label={copy.removeTime} onClick={() => onChange(dueDate, null, scheduleType)}><X size={17} /></button> : null}
          </div>
        ) : null}
      </div>

      {openEditor === "date" ? (
        <div className="weekCalendarPanel">
          <div className="calendarWeekdays" aria-hidden="true">
            {text.common.weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="weekCalendarScroller" onScroll={handleCalendarScroll}>
            <div className="weekCalendarGrid">
              {weekDays.map((day) => {
                const isPast = day.date < todayKey;
                return (
                  <button
                    className={["weekCalendarDay", day.date === todayKey ? "isToday" : "", day.date === dueDate ? "isSelected" : "", isPast ? "isPast" : ""].filter(Boolean).join(" ")}
                    disabled={isPast}
                    data-date={day.date}
                    key={day.date}
                    type="button"
                    onClick={() => selectDate(day.date)}
                  >
                    {day.isMonthStart ? <small>{day.monthLabel}</small> : <small aria-hidden="true">&nbsp;</small>}
                    <span>{day.day}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {openEditor === "time" && !dateOnly ? (
        <div className="inlineTimeEditor">
          <Clock3 size={18} aria-hidden="true" />
          <input
            autoFocus
            type="time"
            value={dueTime ?? ""}
            onInput={(event) => onChange(dueDate, event.currentTarget.value || null, scheduleType)}
          />
        </div>
      ) : null}

      {onSave ? (
        <button className="saveScheduleButton" type="button" onClick={onSave}>
          <Check size={18} aria-hidden="true" />
          {copy.apply}
        </button>
      ) : null}
    </DraggableBottomSheet>
  );
}

function buildForwardWeekDays(weekCount: number, language: AppLanguage) {
  const today = fromDateKey(getTodayKey());
  const sunday = addDays(today, -today.getDay());
  return Array.from({ length: weekCount * 7 }, (_, index) => {
    const date = addDays(sunday, index);
    return {
      date: toDateKey(date),
      day: date.getDate(),
      isMonthStart: date.getDate() === 1 || index === 0,
      monthLabel: new Intl.DateTimeFormat(language, { month: "short" }).format(date),
    };
  });
}

function formatScheduleDate(dateKey: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(fromDateKey(dateKey));
}

function formatScheduleTime(value: string, language: AppLanguage) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit" }).format(date);
}
