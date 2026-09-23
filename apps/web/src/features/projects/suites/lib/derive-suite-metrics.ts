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
  recentPassRate: number | null
  history: RunStatus[]
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

  const recentPassRate =
    completed.length === 0
      ? null
      : Math.round(
          (completed.filter((status) => status === 'pass').length / completed.length) * 100,
        )

  const status = deriveStatus(trend, lastRun, completed, recentPassRate)

  return { suite, lastRun, recentPassRate, history: completed, status }
}

function deriveStatus(
  trend: RunStatus[],
  lastRun: SuiteMetricsLastRun | undefined,
  completed: RunStatus[],
  recentPassRate: number | null,
): SuiteRunStatus {
  if (trend.some((status) => status === 'running')) return 'running'
  if (lastRun === undefined) return 'never-run'
  if (completed.length === 0) return 'needs-attention'
  if (recentPassRate !== null && recentPassRate < PASS_RATE_THRESHOLD) return 'needs-attention'

  return completed[completed.length - 1] === 'pass' ? 'pass' : 'fail'
}
