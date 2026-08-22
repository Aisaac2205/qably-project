'use client'

import { useMemo } from 'react'
import {
  useIngestionBatches,
  useProposals,
  useSuites,
  useRuns,
} from '@/lib/use-mock-store'
import { MOCK_NOW } from '@/lib/mock-data'
import type {
  TraceabilityStageKey,
  TraceabilityLevel,
  ISODateString,
  DayEventBreakdown,
  CalendarDayData,
  CalendarWeekData,
  CalendarMonthLabel,
  TraceabilityCalendarData,
  UseTraceabilityCalendarOptions,
} from '../types/traceability-calendar'

const MONTH_NAMES_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

const MONTH_NAMES_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/**
 * Pseudo-random hash generator for deterministic mock activity seeding
 */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}

function calculateActivityLevel(count: number): TraceabilityLevel {
  if (count <= 0) return 0
  if (count <= 3) return 1
  if (count <= 7) return 2
  if (count <= 12) return 3
  return 4
}

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`
}

function formatDayWithSuffix(dayNumber: number, monthName: string, locale: 'es' | 'en'): string {
  if (locale === 'es') {
    return `${dayNumber} de ${monthName.toLowerCase()}`
  }

  const j = dayNumber % 10
  const k = dayNumber % 100
  let suffix = 'th'
  if (j === 1 && k !== 11) suffix = 'st'
  else if (j === 2 && k !== 12) suffix = 'nd'
  else if (j === 3 && k !== 13) suffix = 'rd'

  return `${monthName} ${dayNumber}${suffix}`
}

export function useTraceabilityCalendar({
  year = 2026,
  activeFilter = 'all',
  locale = 'es',
}: UseTraceabilityCalendarOptions = {}): TraceabilityCalendarData {
  const batches = useIngestionBatches()
  const proposals = useProposals()
  const suites = useSuites()
  const runs = useRuns()

  return useMemo(() => {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    // Adjust start date to previous Sunday (0) to align with standard GitHub week grid
    const firstDayOfWeek = startDate.getDay()
    const calendarStart = new Date(startDate)
    calendarStart.setDate(calendarStart.getDate() - firstDayOfWeek)

    const rawDaysMap = new Map<string, DayEventBreakdown>()
    const currentDate = new Date(calendarStart)
    const endTimestamp = endDate.getTime()
    const refNow = new Date(MOCK_NOW).getTime()

    let daySeed = year * 1000

    while (currentDate.getTime() <= endTimestamp || currentDate.getDay() !== 0) {
      const y = currentDate.getFullYear()
      const m = currentDate.getMonth()
      const d = currentDate.getDate()
      const dateKey = `${y}-${padZero(m + 1)}-${padZero(d)}` as ISODateString
      const currentTs = currentDate.getTime()

      const dayOfWeek = currentDate.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      if (currentTs <= refNow) {
        const randA = pseudoRandom(daySeed++)
        const randB = pseudoRandom(daySeed++)
        const randC = pseudoRandom(daySeed++)
        const randD = pseudoRandom(daySeed++)

        const activityMultiplier = isWeekend ? 0.25 : 1.0
        const isSprintDay = (d % 14 === 0 || d % 14 === 1) && !isWeekend

        const scmCount = Math.floor(
          (randA > 0.6 ? randA * 3 : 0) * (isSprintDay ? 2 : 1) * activityMultiplier,
        )
        const proposalCount = Math.floor(
          (randB > 0.4 ? randB * 5 : 0) * (isSprintDay ? 3 : 1) * activityMultiplier,
        )
        const officialCount = Math.floor(
          (randC > 0.7 ? randC * 2 : 0) * activityMultiplier,
        )
        const runCount = Math.floor(
          (randD > 0.3 ? randD * 8 : 1) * (isSprintDay ? 2.5 : 1) * activityMultiplier,
        )

        rawDaysMap.set(dateKey, {
          scm: scmCount,
          proposals: proposalCount,
          official: officialCount,
          runs: runCount,
        })
      } else {
        rawDaysMap.set(dateKey, {
          scm: 0,
          proposals: 0,
          official: 0,
          runs: 0,
        })
      }

      currentDate.setDate(currentDate.getDate() + 1)
      if (currentDate.getFullYear() > year && currentDate.getDay() === 0) {
        break
      }
    }

    // Overlay live store items into today's date for live reactivity
    const todayKey = MOCK_NOW.split('T')[0] as ISODateString
    const todayExisting = rawDaysMap.get(todayKey) ?? {
      scm: 0,
      proposals: 0,
      official: 0,
      runs: 0,
    }
    rawDaysMap.set(todayKey, {
      scm: Math.max(todayExisting.scm, batches.length),
      proposals: Math.max(todayExisting.proposals, proposals.length),
      official: Math.max(
        todayExisting.official,
        suites.reduce((acc, s) => acc + (s.cases?.length ?? 0), 0),
      ),
      runs: Math.max(todayExisting.runs, runs.length),
    })

    const weeks: CalendarWeekData[] = []
    const monthLabels: CalendarMonthLabel[] = []
    let currentWeekDays: (CalendarDayData | null)[] = []
    let currentWeekIndex = 0
    let lastLabeledMonth = -1

    let totalEvents = 0
    let totalScm = 0
    let totalProposals = 0
    let totalOfficial = 0
    let totalRuns = 0

    const walkDate = new Date(calendarStart)
    const monthNames = locale === 'es' ? MONTH_NAMES_ES : MONTH_NAMES_EN

    while (walkDate.getTime() <= endTimestamp || currentWeekDays.length > 0) {
      const y = walkDate.getFullYear()
      const m = walkDate.getMonth()
      const d = walkDate.getDate()
      const dayOfWeek = walkDate.getDay()
      const dateKey = `${y}-${padZero(m + 1)}-${padZero(d)}` as ISODateString

      const isTargetYear = y === year

      if (isTargetYear) {
        const breakdown = rawDaysMap.get(dateKey) ?? {
          scm: 0,
          proposals: 0,
          official: 0,
          runs: 0,
        }

        totalScm += breakdown.scm
        totalProposals += breakdown.proposals
        totalOfficial += breakdown.official
        totalRuns += breakdown.runs

        const count =
          activeFilter === 'all'
            ? breakdown.scm + breakdown.proposals + breakdown.official + breakdown.runs
            : breakdown[activeFilter as TraceabilityStageKey]

        totalEvents += count

        const fullMonthName = walkDate.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
          month: 'long',
        })
        const formattedShortDate = formatDayWithSuffix(d, fullMonthName, locale)

        const formattedDate = walkDate.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })

        const dayData: CalendarDayData = {
          date: dateKey,
          count,
          level: calculateActivityLevel(count),
          breakdown,
          dayOfWeek,
          monthIndex: m,
          formattedDate,
          formattedShortDate,
        }

        currentWeekDays.push(dayData)

        if (m !== lastLabeledMonth && d <= 7) {
          monthLabels.push({
            monthIndex: m,
            name: monthNames[m] ?? '',
            weekIndex: currentWeekIndex,
          })
          lastLabeledMonth = m
        }
      } else {
        currentWeekDays.push(null)
      }

      if (currentWeekDays.length === 7) {
        weeks.push({
          weekIndex: currentWeekIndex,
          days: currentWeekDays,
        })
        currentWeekDays = []
        currentWeekIndex++
      }

      walkDate.setDate(walkDate.getDate() + 1)

      if (walkDate.getFullYear() > year && currentWeekDays.length === 0) {
        break
      }
    }

    if (currentWeekDays.length > 0) {
      while (currentWeekDays.length < 7) {
        currentWeekDays.push(null)
      }
      weeks.push({
        weekIndex: currentWeekIndex,
        days: currentWeekDays,
      })
    }

    return {
      year,
      totalEvents,
      weeks,
      monthLabels,
      breakdownTotals: {
        scm: totalScm,
        proposals: totalProposals,
        official: totalOfficial,
        runs: totalRuns,
      },
      activeFilter,
    }
  }, [year, activeFilter, locale, batches, proposals, suites, runs])
}
