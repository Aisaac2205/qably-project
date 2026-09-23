import type { ComparisonAreaPoint } from '@qably/ui/dashboard'
import type { DailyPoint } from '@qably/types'

export const HERO_PASS_RATE_DOMAIN: readonly [number, number] = [0, 100]
export const HERO_PASS_RATE_TICKS: readonly number[] = [0, 50, 100]

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
