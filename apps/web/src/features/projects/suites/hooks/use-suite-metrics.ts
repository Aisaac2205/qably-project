'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SuiteMetricsEntry } from '@qably/types'
import { getSuiteMetrics } from '@/features/runs/api/runs.api'
import { runKeys } from '@/features/runs/lib/query-keys'
import { useSuites } from '@/features/projects/suites/hooks/use-suites'
import { deriveSuiteMetrics, type DerivedSuiteMetrics } from '@/features/projects/suites/lib/derive-suite-metrics'

export type SuiteMetrics = DerivedSuiteMetrics

export interface UseSuiteMetricsResult {
  perSuite: SuiteMetrics[]
  isLoading: boolean
  isError: boolean
}

export function useSuiteMetrics(projectId: string): UseSuiteMetricsResult {
  const { suites, isLoading: suitesLoading, isError: suitesError } = useSuites(projectId)

  const metricsQuery = useQuery({
    queryKey: runKeys.suiteMetrics(projectId),
    queryFn: ({ signal }) => getSuiteMetrics(projectId, signal),
    enabled: !suitesLoading && suites.length > 0,
  })

  const entriesBySuiteId = useMemo(() => {
    const map = new Map<string, SuiteMetricsEntry>()
    for (const entry of metricsQuery.data?.items ?? []) {
      map.set(entry.suiteId, entry)
    }
    return map
  }, [metricsQuery.data])

  const perSuite = useMemo(
    () => suites.map((suite) => deriveSuiteMetrics(suite, entriesBySuiteId.get(suite.id))),
    [suites, entriesBySuiteId],
  )

  return {
    perSuite,
    isLoading: suitesLoading || metricsQuery.isLoading,
    isError: suitesError || metricsQuery.isError,
  }
}
