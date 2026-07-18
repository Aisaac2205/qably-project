'use client'

/**
 * Hook that aggregates per-suite execution metrics for a project.
 *
 * Reads suites and runs from the mock store, then derives:
 * - perSuite: one entry per suite with lastRun, passRate7d, sparkline, status
 * - projectMetrics: project-wide aggregate via aggregateForProject
 *
 * All derivations are memoized on the runs reference + suite ids so that
 * re-renders with unchanged data do not recompute the metrics.
 */
import { useMemo } from 'react'
import type { Run, Suite, SuiteRunStatus } from '@qably/types'
import { useRuns, useSuites } from '@/lib/use-mock-store'
import {
  aggregateForProject,
  getLastRun,
  getPassRateLastNDays,
  getSparklineData,
  getSuiteRunStatus,
} from '@/lib/execution-metrics'

export interface SuiteMetrics {
  suite: Suite
  lastRun: Run | undefined
  passRate7d: number
  sparkline: Array<{ date: string; passRate: number; runCount: number }>
  status: SuiteRunStatus
}

export interface UseSuiteMetricsResult {
  perSuite: SuiteMetrics[]
  projectMetrics: {
    totalSuites: number
    totalCases: number
    passRate7d: number
    lastRunAt?: string
  }
}

export function useSuiteMetrics(projectId: string): UseSuiteMetricsResult {
  const suites = useSuites(projectId)
  const runs = useRuns(projectId)

  return useMemo<UseSuiteMetricsResult>(() => {
    const perSuite: SuiteMetrics[] = suites.map((suite) => ({
      suite,
      lastRun: getLastRun(runs, suite.id),
      passRate7d: getPassRateLastNDays(runs, suite.id, 7),
      sparkline: getSparklineData(runs, suite.id),
      status: getSuiteRunStatus(runs, suite.id),
    }))

    const projectMetrics = aggregateForProject(runs, suites)

    return { perSuite, projectMetrics }
    // useMemo depends on the runs and suites references returned by the store.
    // useSyncExternalStore returns the same reference until the store mutates.
  }, [suites, runs])
}
