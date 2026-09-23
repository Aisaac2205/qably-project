import type { ComparisonAreaPoint } from '@qably/ui/dashboard'
import type { DailyPoint } from '@qably/types'

export const HERO_PASS_RATE_DOMAIN: readonly [number, number] = [80, 100]
export const HERO_PASS_RATE_TICKS: readonly number[] = [80, 85, 90, 95, 100]

export interface HeroPassRateDomain {
  domain: readonly [number, number]
  ticks: readonly number[]
}

export function resolveHeroPassRateDomain(
  points: readonly ComparisonAreaPoint[],
): HeroPassRateDomain {
  const values: number[] = []
  for (const point of points) {
    if (point.current !== null) values.push(point.current)
    if (point.previous !== null) values.push(point.previous)
  }

  const min = values.length === 0 ? 80 : Math.min(...values)

  let floor = 80
  while (floor > 0 && min < floor) floor -= 20

  if (floor >= 80) {
    return { domain: HERO_PASS_RATE_DOMAIN, ticks: HERO_PASS_RATE_TICKS }
  }

  const step = (100 - floor) / 4
  const ticks = [0, 1, 2, 3, 4].map((index) => Math.round(floor + step * index))

  return { domain: [floor, 100], ticks }
}

function toPercent(passRate: number | null): number | null {
  return passRate === null ? null : passRate * 100
}

export function buildHeroPoints(
  current: readonly DailyPoint[],
  previous: readonly DailyPoint[],
  formatLabel: (date: string) => string,
): ComparisonAreaPoint[] {
  const length = Math.max(current.length, previous.length)
  const points: ComparisonAreaPoint[] = []

  for (let index = 0; index < length; index += 1) {
    const currentPoint = current[index]
    const previousPoint = previous[index]
    const date = currentPoint?.date ?? previousPoint?.date ?? String(index)

    points.push({
      id: date,
      label: formatLabel(date),
      current: toPercent(currentPoint?.passRate ?? null),
      previous: toPercent(previousPoint?.passRate ?? null),
      runs: currentPoint?.runs,
      failedRuns: currentPoint?.failedRuns,
    })
  }

  return points
}
