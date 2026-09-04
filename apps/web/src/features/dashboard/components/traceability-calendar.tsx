'use client'

import { useState, useRef, useCallback, useId } from 'react'
import { TraceabilityTooltip } from './traceability-tooltip'
import { weekdayNames } from '../lib/traceability-grid'
import type {
  CalendarDayData,
  CalendarWeekData,
  CalendarMonthLabel,
  TooltipCoordinate,
} from '../types/traceability-calendar'

const DAYS_IN_WEEK = 7
const VISIBLE_WEEKDAY_ROWS = [1, 3, 5]

const LEVEL_CLASSES = [
  'bg-heatmap-l0',
  'bg-heatmap-l1',
  'bg-heatmap-l2',
  'bg-heatmap-l3',
  'bg-heatmap-l4',
] as const

export interface TraceabilityCalendarProps {
  readonly weeks: readonly CalendarWeekData[]
  readonly monthLabels: readonly CalendarMonthLabel[]
  readonly locale?: 'es' | 'en'
  readonly caption: string
  readonly lessLabel?: string
  readonly moreLabel?: string
  readonly dayLabel: (day: CalendarDayData) => string
}

interface FocusPosition {
  readonly week: number
  readonly day: number
}

function firstFocusable(weeks: readonly CalendarWeekData[]): FocusPosition {
  for (const week of weeks) {
    const day = week.days.findIndex((cell) => cell !== null)
    if (day !== -1) return { week: week.weekIndex, day }
  }

  return { week: 0, day: 0 }
}

function monthSpans(
  labels: readonly CalendarMonthLabel[],
  weekCount: number,
): { label: CalendarMonthLabel; span: number }[] {
  return labels.map((label, index) => ({
    label,
    span: (labels[index + 1]?.weekIndex ?? weekCount) - label.weekIndex,
  }))
}

export function TraceabilityCalendar({
  weeks,
  monthLabels,
  locale = 'es',
  caption,
  lessLabel = 'Menos',
  moreLabel = 'Más',
  dayLabel,
}: TraceabilityCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const captionId = useId()
  const [active, setActive] = useState<CalendarDayData | null>(null)
  const [position, setPosition] = useState<TooltipCoordinate | null>(null)
  const [focus, setFocus] = useState<FocusPosition>(() => firstFocusable(weeks))

  const names = weekdayNames(locale)
  const spans = monthSpans(monthLabels, weeks.length)

  const show = useCallback((day: CalendarDayData, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const container = containerRef.current?.getBoundingClientRect()

    if (!container) return

    setActive(day)
    setPosition({
      x: rect.left - container.left + rect.width / 2,
      y: rect.top - container.top,
    })
  }, [])

  const hide = useCallback(() => {
    setActive(null)
    setPosition(null)
  }, [])

  const moveFocus = useCallback(
    (from: FocusPosition, weekDelta: number, dayDelta: number) => {
      let week = from.week + weekDelta
      let day = from.day + dayDelta

      if (day < 0) {
        day = DAYS_IN_WEEK - 1
        week -= 1
      } else if (day >= DAYS_IN_WEEK) {
        day = 0
        week += 1
      }

      if (week < 0 || week >= weeks.length) return
      if (weeks[week].days[day] === null) return

      setFocus({ week, day })
      containerRef.current
        ?.querySelector<HTMLElement>(`[data-cell="${week}-${day}"]`)
        ?.focus()
    },
    [weeks],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableCellElement>, at: FocusPosition) => {
      const moves: Record<string, [number, number]> = {
        ArrowRight: [1, 0],
        ArrowLeft: [-1, 0],
        ArrowDown: [0, 1],
        ArrowUp: [0, -1],
      }
      const move = moves[event.key]

      if (move === undefined) return

      event.preventDefault()
      moveFocus(at, move[0], move[1])
    },
    [moveFocus],
  )

  return (
    <div className="relative" ref={containerRef}>
      <TraceabilityTooltip day={active} position={position} />

      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <table
          role="grid"
          className="w-full min-w-[620px] table-fixed border-separate border-spacing-[3px]"
          aria-labelledby={captionId}
        >
          <caption id={captionId} className="sr-only">
            {caption}
          </caption>
          <colgroup>
            <col className="w-7" />
            <col span={weeks.length} />
          </colgroup>
          <thead>
            <tr role="row">
              <td role="gridcell" />
              {spans.map(({ label, span }) => (
                <th
                  key={`${label.monthIndex}-${label.weekIndex}`}
                  role="columnheader"
                  scope="col"
                  colSpan={span}
                  className="pb-1.5 text-left text-[10px] font-medium whitespace-nowrap text-muted"
                >
                  {label.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: DAYS_IN_WEEK }, (_, dayIndex) => (
              <tr key={dayIndex} role="row">
                <th
                  role="rowheader"
                  scope="row"
                  className="pr-1.5 text-left align-middle text-[10px] font-medium whitespace-nowrap text-muted"
                >
                  {VISIBLE_WEEKDAY_ROWS.includes(dayIndex) ? (
                    names[dayIndex]
                  ) : (
                    <span className="sr-only">{names[dayIndex]}</span>
                  )}
                </th>

                {weeks.map((week) => {
                  const day = week.days[dayIndex]

                  if (!day) {
                    return (
                      <td
                        key={week.weekIndex}
                        role="gridcell"
                        className="p-0"
                        aria-hidden="true"
                      >
                        <div className="aspect-square w-full" />
                      </td>
                    )
                  }

                  const at = { week: week.weekIndex, day: dayIndex }
                  const isFocusTarget =
                    focus.week === week.weekIndex && focus.day === dayIndex

                  return (
                    <td
                      key={week.weekIndex}
                      role="gridcell"
                      data-cell={`${week.weekIndex}-${dayIndex}`}
                      data-level={day.level}
                      tabIndex={isFocusTarget ? 0 : -1}
                      aria-label={dayLabel(day)}
                      onKeyDown={(event) => onKeyDown(event, at)}
                      onFocus={(event) => {
                        setFocus(at)
                        show(day, event.currentTarget)
                      }}
                      onBlur={hide}
                      onMouseEnter={(event) => show(day, event.currentTarget)}
                      onMouseLeave={hide}
                      className="rounded-[3px] p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                    >
                      <div
                        className={`aspect-square w-full rounded-[3px] transition-opacity duration-100 hover:opacity-85 ${LEVEL_CLASSES[day.level]}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted">
        <span>{lessLabel}</span>
        {LEVEL_CLASSES.map((levelClass) => (
          <span
            key={levelClass}
            className={`inline-block size-2.5 rounded-[2px] border border-border/40 ${levelClass}`}
            aria-hidden="true"
          />
        ))}
        <span>{moreLabel}</span>
      </div>
    </div>
  )
}
