import type { DailyPoint } from '@qably/types'
import type { Locale } from '@/lib/i18n'

const DATE_LOCALE_TAG: Record<Locale, string> = {
  es: 'es-ES',
  en: 'en-US',
}

function resolveDateLocaleTag(locale: Locale): string {
  return DATE_LOCALE_TAG[locale] ?? DATE_LOCALE_TAG.en
}

const dayMonthFormatters = new Map<string, Intl.DateTimeFormat>()
const dayOnlyFormatters = new Map<string, Intl.DateTimeFormat>()

function dayMonthFormatter(tag: string): Intl.DateTimeFormat {
  const cached = dayMonthFormatters.get(tag)
  if (cached) return cached
  const created = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' })
  dayMonthFormatters.set(tag, created)
  return created
}

function dayOnlyFormatter(tag: string): Intl.DateTimeFormat {
  const cached = dayOnlyFormatters.get(tag)
  if (cached) return cached
  const created = new Intl.DateTimeFormat(tag, { day: 'numeric' })
  dayOnlyFormatters.set(tag, created)
  return created
}

/**
 * Parses a series date key ('YYYY-MM-DD') as local midnight, never UTC.
 * `new Date('YYYY-MM-DD')` parses as UTC per the spec, which mislabels the
 * day by one in any timezone behind UTC — this is the fix for that bug.
 */
export function parseSeriesDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function formatSeriesDayLabel(date: Date, locale: Locale): string {
  return dayMonthFormatter(resolveDateLocaleTag(locale)).format(date)
}

export type SeriesRangePoint = Pick<DailyPoint, 'date' | 'rangeEnd'>

/**
 * Formats a series bucket's date for display. Daily buckets (or a bucket
 * whose range collapses to a single day) render as "24 sep". Weekly buckets
 * render as a range, "22–28 sep", dropping the repeated month on the start
 * side unless the range crosses a month boundary ("29 sep–5 oct").
 */
export function formatSeriesRange(
  point: SeriesRangePoint,
  granularity: 'day' | 'week',
  locale: Locale,
): string {
  const tag = resolveDateLocaleTag(locale)
  const start = parseSeriesDate(point.date)

  if (granularity === 'day' || point.date === point.rangeEnd) {
    return dayMonthFormatter(tag).format(start)
  }

  const end = parseSeriesDate(point.rangeEnd)
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
  const startLabel = sameMonth ? dayOnlyFormatter(tag).format(start) : dayMonthFormatter(tag).format(start)

  return `${startLabel}–${dayMonthFormatter(tag).format(end)}`
}
