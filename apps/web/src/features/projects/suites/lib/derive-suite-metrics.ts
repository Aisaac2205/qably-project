import type {
  RunStatus,
  Suite,
  SuiteMetricsEntry,
  SuiteMetricsLastRun,
  SuiteRunStatus,
} from '@qably/types'

export interface DerivedSuiteMetrics {
  suite: Suite
  lastRun: SuiteMetricsLastRun | undefined
  passRate7d: number
  sparkline: Array<{ date: string; passRate: number; runCount: number }>
  status: SuiteRunStatus
}

const PASS_RATE_THRESHOLD = 70

function isCompleted(status: RunStatus): boolean {
  return status === 'pass' || status === 'fail'
}

export function deriveSuiteMetrics(
  suite: Suite,
  entry: SuiteMetricsEntry | undefined,
): DerivedSuiteMetrics {
  const lastRun = entry?.lastRun ?? undefined
  const trend = entry?.trend ?? []
  const completed = trend.filter(isCompleted)

  const passRate7d =
    completed.length === 0
      ? 0
      : Math.round(
          (completed.filter((status) => status === 'pass').length / completed.length) * 100,
        )

  const sparkline = completed.map((status, index) => ({
    date: `trend-${index}`,
    passRate: status === 'pass' ? 100 : 0,
    runCount: 1,
  }))

  const status = deriveStatus(trend, lastRun, completed, passRate7d)

  return { suite, lastRun, passRate7d, sparkline, status }
}

function deriveStatus(
  trend: RunStatus[],
  lastRun: SuiteMetricsLastRun | undefined,
  completed: RunStatus[],
  passRate7d: number,
): SuiteRunStatus {
  if (trend.some((status) => status === 'running')) return 'running'
  if (lastRun === undefined) return 'never-run'
  if (completed.length === 0) return 'needs-attention'
  if (passRate7d < PASS_RATE_THRESHOLD) return 'needs-attention'

  return completed[completed.length - 1] === 'pass' ? 'pass' : 'fail'
}
