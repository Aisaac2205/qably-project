import type { DailyPoint } from '@qably/types'

export interface ExecutedCasesPoint {
  id: string
  label: string
  current: number
  previous: number
  passed: number
  failed: number
  blocked: number
}

export function buildExecutedCasesPoints(
  current: readonly DailyPoint[],
  previous: readonly DailyPoint[],
  formatLabel: (date: string) => string,
): ExecutedCasesPoint[] {
  const length = Math.max(current.length, previous.length)
  const points: ExecutedCasesPoint[] = []

  for (let index = 0; index < length; index += 1) {
    const currentPoint = current[index]
    const previousPoint = previous[index]
    const date = currentPoint?.date ?? previousPoint?.date ?? String(index)

    points.push({
      id: date,
      label: formatLabel(date),
      current: currentPoint?.executed ?? 0,
      previous: previousPoint?.executed ?? 0,
      passed: currentPoint?.passed ?? 0,
      failed: currentPoint?.failed ?? 0,
      blocked: currentPoint?.blocked ?? 0,
    })
  }

  return points
}

export type ExecutedCasesTrendDirection = 'up' | 'down' | 'equal'

export interface ExecutedCasesTrend {
  direction: ExecutedCasesTrendDirection
  percent: number | null
  currentTotal: number
  previousTotal: number
}

export function resolveExecutedCasesTrend(
  points: readonly Pick<ExecutedCasesPoint, 'current' | 'previous'>[],
): ExecutedCasesTrend {
  const currentTotal = points.reduce((sum, point) => sum + point.current, 0)
  const previousTotal = points.reduce((sum, point) => sum + point.previous, 0)
  const diff = currentTotal - previousTotal

  const direction: ExecutedCasesTrendDirection = diff > 0 ? 'up' : diff < 0 ? 'down' : 'equal'
  const percent = previousTotal === 0 ? null : Math.round((Math.abs(diff) / previousTotal) * 100)

  return { direction, percent, currentTotal, previousTotal }
}

export function resolvePeriodRangeLabel(
  points: readonly Pick<ExecutedCasesPoint, 'id'>[],
  formatDate: (date: string) => string,
): string | null {
  if (points.length === 0) return null

  const first = points[0]
  const last = points[points.length - 1]

  if (first.id === last.id) return formatDate(first.id)

  return `${formatDate(first.id)} – ${formatDate(last.id)}`
}
