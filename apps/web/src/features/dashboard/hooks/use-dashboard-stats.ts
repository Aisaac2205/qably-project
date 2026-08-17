'use client'

import { useMemo } from 'react'
import {
  useProjects,
  useRuns,
  useAiCases,
  useOrg,
  useCoverageGaps,
} from '@/lib/use-mock-store'
import { MOCK_NOW } from '@/lib/mock-data'
import type {
  Project,
  Run,
  AiCase,
  RunStatus,
} from '@qably/types'

export interface DashboardStats {
  totalProjects: number
  totalSuites: number
  totalRuns: number
  runsLast7d: number
  pendingAiCases: number
  passRateLast7d: number
  passRateTrend: number
  coverageGapsCount: number
  activeRuns: number
  projectsByHealth: Array<{
    project: Project
    lastRunStatus: RunStatus
    lastRunAt: string
  }>
  recentRuns: Run[]
  recentAiCases: AiCase[]
  recentCiRuns: Run[]
}

const MS_7D = 7 * 24 * 60 * 60 * 1000

export function useDashboardStats(): DashboardStats {
  const projects = useProjects()
  const runs = useRuns()
  const aiCases = useAiCases()
  const org = useOrg()
  const coverageGaps = useCoverageGaps()

  return useMemo(() => {
    const now = new Date(MOCK_NOW).getTime()
    const sevenDaysAgo = now - MS_7D
    const fourteenDaysAgo = now - 2 * MS_7D

    // Total suites = sum of suiteCount across all projects
    const totalSuites = projects.reduce((sum, p) => sum + p.suiteCount, 0)

    // Runs started in the last 7 days
    const runsLast7d = runs.filter(
      (r) => new Date(r.startedAt).getTime() >= sevenDaysAgo,
    ).length

    // Active runs
    const activeRuns = runs.filter((r) => r.status === 'running').length

    // Pass rate: average of finished runs in last 7 days
    const recentFinished = runs.filter(
      (r) => r.finishedAt && new Date(r.finishedAt).getTime() >= sevenDaysAgo,
    )
    const passRateLast7d =
      recentFinished.length > 0
        ? Math.round(
            recentFinished.reduce((sum, r) => sum + r.passRate, 0) /
              recentFinished.length,
          )
        : 0

    // Pass rate trend: delta vs prior 7-day period
    const priorFinished = runs.filter(
      (r) =>
        r.finishedAt &&
        new Date(r.finishedAt).getTime() >= fourteenDaysAgo &&
        new Date(r.finishedAt).getTime() < sevenDaysAgo,
    )
    const priorRate =
      priorFinished.length > 0
        ? Math.round(
            priorFinished.reduce((sum, r) => sum + r.passRate, 0) /
              priorFinished.length,
          )
        : 0
    const passRateTrend = passRateLast7d - priorRate

    // Pending AI cases (all projects)
    const pendingAiCases = aiCases.filter(
      (c) => c.reviewStatus === 'pending',
    ).length

    // Projects by health
    const projectsByHealth = projects.map((p) => ({
      project: p,
      lastRunStatus: p.lastRunStatus,
      lastRunAt: p.lastRunAt,
    }))

    // Recent runs: top 5 by startedAt desc
    const recentRuns = [...runs]
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, 5)

    // Recent AI cases: top 5 pending by sourceFile (stable sort for determinism)
    const recentAiCases = [...aiCases]
      .filter((c) => c.reviewStatus === 'pending')
      .sort((a, b) => a.sourceFile.localeCompare(b.sourceFile))
      .slice(0, 5)

    // Recent CI runs: top 5 github_actions runs by startedAt desc
    const recentCiRuns = [...runs]
      .filter((r) => r.source === 'github_actions')
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, 5)

    return {
      totalProjects: projects.length,
      totalSuites,
      totalRuns: runs.length,
      runsLast7d,
      pendingAiCases,
      passRateLast7d,
      passRateTrend,
      coverageGapsCount: coverageGaps.length,
      activeRuns,
      projectsByHealth,
      recentRuns,
      recentAiCases,
      recentCiRuns,
    }
  }, [projects, runs, aiCases, org, coverageGaps])
}
