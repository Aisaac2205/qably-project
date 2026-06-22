/**
 * Pure functions for deriving suite-level execution metrics from the Run array.
 *
 * Architectural principle: derived metrics are computed on-the-fly from Runs,
 * never stored on Suite. These functions are the single source of truth for
 * last-run, pass-rate, sparkline, and status data.
 *
 * All functions are deterministic given a `now` reference timestamp — pass
 * `now` explicitly in tests to avoid time-based flakiness.
 */
import type { Run, RunStatus, Suite, SuiteRunStatus } from '@qably/types'

/**
 * Project-level aggregated metrics for KPI cards and dashboards.
 */
export interface ProjectMetrics {
  totalSuites: number
  totalCases: number
  /** Project-wide pass rate over the last 7 days, 0–100. */
  passRate7d: number
  /** ISO timestamp of the most recent run across the project (any status, any suite). */
  lastRunAt?: string
}

// ── Date helper ──────────────────────────────────────────────────────────

/**
 * Convert a Date to a local-date string key (YYYY-MM-DD) for day bucketing.
 * Uses the runtime's local timezone — consistent with the project's existing
 * toLocaleDateString usage in suite-row.tsx, pass-rate-chart.tsx, and format.ts.
 */
export function toLocalDateString(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

// ── Internal helpers ────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

function isCompleted(status: RunStatus): boolean {
  return status === 'pass' || status === 'fail'
}

function runsForSuite(runs: Run[], suiteId: string): Run[] {
  return runs.filter((r) => r.suiteId === suiteId)
}

function byStartedAtDesc(a: Run, b: Run): number {
  return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
}

function sortByStartedAtDesc(runs: Run[]): Run[] {
  return [...runs].sort(byStartedAtDesc)
}

function windowStart(now: number, n: number): number {
  return now - n * DAY_MS
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Get the most recent run for a suite, sorted by startedAt descending.
 * Returns undefined if no runs exist for the suite.
 */
export function getLastRun(runs: Run[], suiteId: string): Run | undefined {
  const suiteRuns = runsForSuite(runs, suiteId)
  if (suiteRuns.length === 0) return undefined
  return sortByStartedAtDesc(suiteRuns)[0]
}

/**
 * Compute the pass rate for completed runs within the last N days.
 * Running/pending runs are excluded. Returns 0–100.
 * Returns 0 if no completed runs exist in the window.
 *
 * @param now - Reference timestamp (epoch ms). Defaults to Date.now().
 */
export function getPassRateLastNDays(
  runs: Run[],
  suiteId: string,
  n: number,
  now: number = Date.now(),
): number {
  const start = windowStart(now, n)
  let passed = 0
  let total = 0
  for (const r of runsForSuite(runs, suiteId)) {
    if (!isCompleted(r.status)) continue
    const t = new Date(r.finishedAt ?? r.startedAt).getTime()
    if (t < start) continue
    total++
    if (r.status === 'pass') passed++
  }
  if (total === 0) return 0
  return Math.round((passed / total) * 100)
}

/**
 * Generate sparkline data: per-day pass rate for the last 7 days,
 * oldest first (index 0 = 6 days ago, index 6 = today).
 * Days with no runs report passRate: 0 and runCount: 0.
 */
export function getSparklineData(
  runs: Run[],
  suiteId: string,
  now: number = Date.now(),
): Array<{ date: string; passRate: number; runCount: number }> {
  const today = new Date(now)
  const todayKey = toLocalDateString(today)
  const dayKeys: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS)
    dayKeys.push(toLocalDateString(d))
  }

  // Bucket completed runs by local date.
  const buckets = new Map<string, { passed: number; total: number; count: number }>()
  for (const r of runsForSuite(runs, suiteId)) {
    const t = new Date(r.finishedAt ?? r.startedAt).getTime()
    if (t < windowStart(now, 7)) continue
    const key = toLocalDateString(new Date(r.finishedAt ?? r.startedAt))
    if (!dayKeys.includes(key)) continue
    const b = buckets.get(key) ?? { passed: 0, total: 0, count: 0 }
    b.count++
    if (isCompleted(r.status)) {
      b.total++
      if (r.status === 'pass') b.passed++
    }
    buckets.set(key, b)
  }

  return dayKeys.map((date) => {
    const b = buckets.get(date)
    if (!b || b.total === 0) {
      return { date, passRate: 0, runCount: 0 }
    }
    return {
      date,
      passRate: Math.round((b.passed / b.total) * 100),
      runCount: b.count,
    }
  })
}

/**
 * Derive the suite-level run status from runs.
 * Priority:
 *  1. Any run is `running` → 'running'
 *  2. No runs at all → 'never-run'
 *  3. Pass rate 7d < 70% (and ≥1 completed in window) → 'needs-attention'
 *  4. Last completed run's status → 'pass' or 'fail'
 *  5. Fallback when no completed runs anywhere → 'needs-attention'
 *
 * @param now - Reference timestamp (epoch ms). Defaults to Date.now().
 */
export function getSuiteRunStatus(
  runs: Run[],
  suiteId: string,
  now: number = Date.now(),
): SuiteRunStatus {
  const suiteRuns = runsForSuite(runs, suiteId)
  if (suiteRuns.length === 0) return 'never-run'
  if (suiteRuns.some((r) => r.status === 'running')) return 'running'

  const completed = suiteRuns.filter((r) => isCompleted(r.status))
  if (completed.length === 0) return 'needs-attention'

  // Threshold check: pass rate over 7d < 70 → needs-attention.
  // This naturally covers the "no runs in window" case (rate = 0).
  const rate7d = getPassRateLastNDays(runs, suiteId, 7, now)
  if (rate7d < 70) return 'needs-attention'

  const last = sortByStartedAtDesc(completed)[0]
  return last.status === 'pass' ? 'pass' : 'fail'
}

/**
 * Aggregate project-level metrics across all suites and runs.
 * `suites` is the list of suites that belong to the project.
 */
export function aggregateForProject(
  runs: Run[],
  suites: Suite[],
  now: number = Date.now(),
): ProjectMetrics {
  const suiteIds = new Set(suites.map((s) => s.id))
  const projectRuns = runs.filter((r) => suiteIds.has(r.suiteId))

  let lastRunAt: string | undefined
  for (const r of projectRuns) {
    if (!lastRunAt || r.startedAt > lastRunAt) lastRunAt = r.startedAt
  }

  // Project-wide pass rate over last 7d, no suiteId filter.
  const start = windowStart(now, 7)
  let passed = 0
  let total = 0
  for (const r of projectRuns) {
    if (!isCompleted(r.status)) continue
    const t = new Date(r.finishedAt ?? r.startedAt).getTime()
    if (t < start) continue
    total++
    if (r.status === 'pass') passed++
  }
  const passRate7d = total === 0 ? 0 : Math.round((passed / total) * 100)

  const totalCases = suites.reduce((acc, s) => acc + s.cases.length, 0)

  return {
    totalSuites: suites.length,
    totalCases,
    passRate7d,
    lastRunAt,
  }
}
