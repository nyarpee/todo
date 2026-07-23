export type CalendarDay = {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string): Date {
  const parts = dateKey.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function getTodayKey(): string {
  return toDateKey(new Date());
}

export function getTomorrowKey(): string {
  return toDateKey(addDays(new Date(), 1));
}

export function getMonthLabel(monthDate: Date, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(monthDate);
}

export function getDisplayDate(dateKey: string | null, locale = "en", noDateLabel = "No date"): string {
  if (!dateKey) return noDateLabel;

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(fromDateKey(dateKey));
}


export function getScheduleLabel(
  dueDate: string | null,
  dueTime: string | null,
  options: { locale?: string; noDateLabel?: string } = {},
): string {
  const locale = options.locale ?? "en";
  const noDateLabel = options.noDateLabel ?? "No date";
  if (!dueDate) return noDateLabel;
  const displayDate = getDisplayDate(dueDate, locale, noDateLabel);
  return dueTime ? `${displayDate} ${dueTime}` : displayDate;
}

export function getCompactScheduleLabel(
  dueDate: string,
  dueTime: string | null,
  scheduleType: "scheduled" | "deadline",
  locale = "en",
): string {
  const date = fromDateKey(dueDate);
  const isEnglish = locale.toLowerCase().startsWith("en");
  const isJapanese = locale.toLowerCase().startsWith("ja");
  const dateLabel = new Intl.DateTimeFormat(locale, isEnglish
    ? { month: "short", day: "numeric" }
    : { month: "numeric", day: "numeric" }).format(date);
  const timeLabel = dueTime ? ` ${formatScheduleTime(dueTime, locale)}` : "";

  if (isEnglish) {
    return `${scheduleType === "deadline" ? "By" : "On"} ${dateLabel}${timeLabel}`;
  }

  if (isJapanese) {
    return `${dateLabel}${timeLabel}${scheduleType === "deadline" ? "まで" : "に"}`;
  }

  const isSimplifiedChinese = locale.toLowerCase() === "zh-cn";
  return `${dateLabel}${timeLabel} ${scheduleType === "deadline" ? "截止" : isSimplifiedChinese ? "当天" : "當天"}`;
}

function formatScheduleTime(value: string, locale: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function buildCalendarDays(monthDate: Date): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = addDays(firstDay, -firstDay.getDay());
  const todayKey = getTodayKey();

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    const dateKey = toDateKey(date);

    return {
      date: dateKey,
      dayOfMonth: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === todayKey,
    };
  });
}

export function diffDaysFromKey(dateKey: string, fromKey: string): number {
  const target = fromDateKey(dateKey).getTime();
  const base = fromDateKey(fromKey).getTime();
  return Math.round((target - base) / 86_400_000);
}

export function getRelativeDayLabel(
  days: number,
  locale = "en",
  options: { compact?: boolean } = {},
): string {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("ja")) {
    if (days === 0) return "今日";
    if (days > 0) return `あと${days}日`;
    return `${Math.abs(days)}日超過`;
  }
  if (normalized.startsWith("en")) {
    if (days === 0) return "today";
    if (days > 0) return `${days}d left`;
    return options.compact ? `${Math.abs(days)}d late` : `${Math.abs(days)}d overdue`;
  }
  if (days === 0) return "今天";
  if (days > 0) return `還有${days}天`;
  return `逾期${Math.abs(days)}天`;
}

export function getRemainingHourCount(
  dueDate: string,
  dueTime: string | null,
  now = new Date(),
): number | null {
  const target = fromDateKey(dueDate);
  if (dueTime) {
    const [hours = 0, minutes = 0] = dueTime.split(":").map(Number);
    target.setHours(hours, minutes, 0, 0);
  } else {
    // A date without a time remains actionable through the end of that day.
    target.setHours(23, 59, 59, 999);
  }

  const remainingMs = target.getTime() - now.getTime();
  if (remainingMs <= 0 || remainingMs >= 86_400_000) return null;
  return Math.max(1, Math.ceil(remainingMs / 3_600_000));
}

export function getRelativeHourLabel(hours: number, locale = "en"): string {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("ja")) return `\u3042\u3068${hours}\u6642\u9593`;
  if (normalized.startsWith("en")) return `${hours}h left`;
  if (normalized === "zh-cn") return `\u8fd8\u5269${hours}\u5c0f\u65f6`;
  return `\u9084\u6709${hours}\u5c0f\u6642`;
}

export function getWeekdayIndexFromKey(dateKey: string): number {
  return fromDateKey(dateKey).getDay();
}

export function getMonthLabelFromKey(dateKey: string, locale = "en"): string {
  return getMonthLabel(fromDateKey(dateKey), locale);
}

export function sortScheduleValues(
  firstDate: string | null,
  firstTime: string | null,
  secondDate: string | null,
  secondTime: string | null,
): number {
  if (firstDate === null && secondDate === null) return 0;
  if (firstDate === null) return 1;
  if (secondDate === null) return -1;

  const dateCompare = firstDate.localeCompare(secondDate);
  if (dateCompare !== 0) return dateCompare;

  if (firstTime === null && secondTime === null) return 0;
  if (firstTime === null) return 1;
  if (secondTime === null) return -1;

  return firstTime.localeCompare(secondTime);
}
