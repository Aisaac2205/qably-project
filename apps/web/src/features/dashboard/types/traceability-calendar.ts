/**
 * Advanced TypeScript definitions for the Traceability Contribution Calendar.
 *
 * Implements strict domain models, discriminated unions, mapped types,
 * readonly immutability, and generic type helpers following typescript-advanced-types.
 */

export type TraceabilityStageKey =
  | 'scm'
  | 'proposals'
  | 'official'
  | 'runs'

export type TraceabilityFilter = 'all' | TraceabilityStageKey

export type TraceabilityLevel = 0 | 1 | 2 | 3 | 4

/**
 * Strongly typed ISO Date string format (YYYY-MM-DD)
 */
export type ISODateString = `${number}-${string}-${string}`

/**
 * Mapped type for event breakdown counts per day
 */
export type DayEventBreakdown = Readonly<Record<TraceabilityStageKey, number>>

/**
 * Single day entry in the traceability calendar
 */
export interface CalendarDayData {
  readonly date: ISODateString
  readonly count: number
  readonly level: TraceabilityLevel
  readonly breakdown: DayEventBreakdown
  readonly dayOfWeek: number // 0 (Sunday) to 6 (Saturday)
  readonly monthIndex: number // 0 to 11
  readonly formattedDate: string
  readonly formattedShortDate: string // e.g., "29 de abril" / "April 29th"
}

/**
 * Single week column in the calendar grid (7 days)
 */
export interface CalendarWeekData {
  readonly weekIndex: number
  readonly days: readonly (CalendarDayData | null)[]
}

/**
 * Month header marker positioned at a specific week column
 */
export interface CalendarMonthLabel {
  readonly monthIndex: number
  readonly name: string
  readonly weekIndex: number
}

/**
 * Complete processed calendar dataset
 */
export interface TraceabilityCalendarData {
  readonly year: number
  readonly totalEvents: number
  readonly weeks: readonly CalendarWeekData[]
  readonly monthLabels: readonly CalendarMonthLabel[]
  readonly breakdownTotals: DayEventBreakdown
  readonly activeFilter: TraceabilityFilter
}

/**
 * Tooltip coordinate position payload
 */
export interface TooltipCoordinate {
  readonly x: number
  readonly y: number
}

/**
 * Theme color levels for GitHub-style intensity mapping
 */
export type HeatmapColorLevels = Readonly<Record<`level${TraceabilityLevel}`, string>>

/**
 * Configuration options for the traceability calendar hook
 */
export interface UseTraceabilityCalendarOptions {
  readonly year?: number
  readonly activeFilter?: TraceabilityFilter
  readonly locale?: 'es' | 'en'
}
