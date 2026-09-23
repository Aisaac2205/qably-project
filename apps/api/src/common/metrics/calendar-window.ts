import { startOfZonedDay, zonedDateKey } from '../time-zone/time-zone';

export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export function isDashboardPeriod(value: number): value is DashboardPeriod {
  return (DASHBOARD_PERIODS as readonly number[]).includes(value);
}

export interface CalendarWindow {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function parseZonedDateKey(key: string): CalendarDate {
  const [year, month, day] = key.split('-').map(Number);

  return { year, month, day };
}

function shiftCalendarDate(
  date: CalendarDate,
  deltaDays: number,
): CalendarDate {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + deltaDays),
  );

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function startOfCalendarDate(date: CalendarDate, zone: string): Date {
  return startOfZonedDay(date.year, date.month, date.day, zone);
}

export function computeCalendarWindow(
  period: DashboardPeriod,
  zone: string,
  now: Date,
): CalendarWindow {
  if (!isDashboardPeriod(period)) {
    throw new Error(`Unsupported dashboard period: ${String(period)}`);
  }

  const today = parseZonedDateKey(zonedDateKey(now, zone));
  const currentStartDate = shiftCalendarDate(today, -(period - 1));
  const currentStart = startOfCalendarDate(currentStartDate, zone);
  const previousStartDate = shiftCalendarDate(currentStartDate, -period);
  const previousStart = startOfCalendarDate(previousStartDate, zone);

  return {
    currentStart,
    currentEnd: now,
    previousStart,
    previousEnd: currentStart,
  };
}
