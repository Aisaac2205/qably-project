import {
  DASHBOARD_PERIODS,
  isDashboardPeriod,
  type DashboardPeriod,
} from '@qably/types';
import { startOfZonedDay, zonedDateKey } from '../time-zone/time-zone';

export { DASHBOARD_PERIODS, isDashboardPeriod, type DashboardPeriod };

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

function formatCalendarDate(date: CalendarDate): string {
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');

  return `${date.year}-${month}-${day}`;
}

export interface CalendarDayKeys {
  current: string[];
  previous: string[];
}

export interface FixedCalendarWindow {
  start: Date;
  end: Date;
  dayKeys: string[];
}

export function fixedCalendarWindow(
  days: number,
  zone: string,
  now: Date,
): FixedCalendarWindow {
  const today = parseZonedDateKey(zonedDateKey(now, zone));
  const startDate = shiftCalendarDate(today, -(days - 1));
  const start = startOfCalendarDate(startDate, zone);
  const dayKeys = Array.from({ length: days }, (_, index) =>
    formatCalendarDate(shiftCalendarDate(startDate, index)),
  );

  return { start, end: now, dayKeys };
}

export function calendarDayKeys(
  period: DashboardPeriod,
  zone: string,
  now: Date,
): CalendarDayKeys {
  if (!isDashboardPeriod(period)) {
    throw new Error(`Unsupported dashboard period: ${String(period)}`);
  }

  const today = parseZonedDateKey(zonedDateKey(now, zone));
  const currentStartDate = shiftCalendarDate(today, -(period - 1));
  const previousStartDate = shiftCalendarDate(currentStartDate, -period);

  const current = Array.from({ length: period }, (_, index) =>
    formatCalendarDate(shiftCalendarDate(currentStartDate, index)),
  );
  const previous = Array.from({ length: period }, (_, index) =>
    formatCalendarDate(shiftCalendarDate(previousStartDate, index)),
  );

  return { current, previous };
}
