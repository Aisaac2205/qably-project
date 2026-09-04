import type {
  TraceabilityCalendarRecord,
  TraceabilityDayRecord,
  TraceabilityStage,
} from '@qably/types'
import type {
  CalendarDayData,
  CalendarMonthLabel,
  CalendarWeekData,
  ISODateString,
  TraceabilityFilter,
  TraceabilityLevel,
} from '../types/traceability-calendar'

const DAYS_IN_WEEK = 7

export type LevelThresholds = readonly [number, number, number]

export interface TraceabilityGrid {
  readonly year: number
  readonly totalEvents: number
  readonly breakdownTotals: TraceabilityCalendarRecord['totals']
  readonly weeks: readonly CalendarWeekData[]
  readonly monthLabels: readonly CalendarMonthLabel[]
}

function quantile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.floor((sorted.length - 1) * fraction)]
}

export function computeLevelThresholds(counts: readonly number[]): LevelThresholds {
  const active = counts.filter((count) => count > 0).sort((a, b) => a - b)

  if (active.length === 0) return [1, 1, 1]

  return [
    Math.max(1, quantile(active, 0.25)),
    Math.max(1, quantile(active, 0.5)),
    Math.max(1, quantile(active, 0.75)),
  ]
}

function levelFor(count: number, thresholds: LevelThresholds): TraceabilityLevel {
  if (count <= 0) return 0
  if (count <= thresholds[0]) return 1
  if (count <= thresholds[1]) return 2
  if (count <= thresholds[2]) return 3

  return 4
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

function isoDate(date: Date): ISODateString {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as ISODateString
}

function countFor(day: TraceabilityDayRecord, filter: TraceabilityFilter): number {
  if (filter === 'all') {
    return day.scm + day.proposals + day.official + day.runs
  }

  return day[filter as TraceabilityStage]
}

const EMPTY_DAY = { scm: 0, proposals: 0, official: 0, runs: 0 } as const

export function buildTraceabilityGrid(
  record: TraceabilityCalendarRecord,
  filter: TraceabilityFilter,
  monthNames: readonly string[],
  locale: 'es' | 'en' = 'es',
): TraceabilityGrid {
  const { year } = record
  const byDate = new Map(record.days.map((day) => [day.date, day]))

  const first = new Date(year, 0, 1)
  const last = new Date(year, 11, 31)

  const counts: number[] = []
  for (const day of record.days) counts.push(countFor(day, filter))
  const thresholds = computeLevelThresholds(counts)

  const intlLocale = locale === 'es' ? 'es-ES' : 'en-US'
  const weeks: CalendarWeekData[] = []
  const monthLabels: CalendarMonthLabel[] = []

  let cursor = new Date(first)
  cursor.setDate(cursor.getDate() - cursor.getDay())

  let weekIndex = 0
  let labelledMonth = -1
  let totalEvents = 0

  while (cursor <= last || cursor.getDay() !== 0) {
    const days: (CalendarDayData | null)[] = []

    for (let slot = 0; slot < DAYS_IN_WEEK; slot += 1) {
      if (cursor.getFullYear() !== year) {
        days.push(null)
      } else {
        const date = isoDate(cursor)
        const breakdown = byDate.get(date) ?? { date, ...EMPTY_DAY }
        const count = countFor(breakdown, filter)

        totalEvents += count

        days.push({
          date,
          count,
          level: levelFor(count, thresholds),
          breakdown: {
            scm: breakdown.scm,
            proposals: breakdown.proposals,
            official: breakdown.official,
            runs: breakdown.runs,
          },
          dayOfWeek: cursor.getDay(),
          monthIndex: cursor.getMonth(),
          formattedDate: cursor.toLocaleDateString(intlLocale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          formattedShortDate: cursor.toLocaleDateString(intlLocale, {
            day: 'numeric',
            month: 'long',
          }),
        })

        if (cursor.getMonth() !== labelledMonth) {
          labelledMonth = cursor.getMonth()
          monthLabels.push({
            monthIndex: labelledMonth,
            name: monthNames[labelledMonth] ?? '',
            weekIndex,
          })
        }
      }

      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() + 1)
    }

    weeks.push({ weekIndex, days })
    weekIndex += 1

    if (cursor.getFullYear() > year) break
  }

  return {
    year,
    totalEvents,
    breakdownTotals: record.totals,
    weeks,
    monthLabels,
  }
}
