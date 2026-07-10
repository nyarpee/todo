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

export function getEndOfWeekKey(): string {
  const today = new Date();
  const daysUntilSunday = 6 - today.getDay();
  return toDateKey(addDays(today, daysUntilSunday));
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
