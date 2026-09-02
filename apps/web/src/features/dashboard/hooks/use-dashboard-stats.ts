'use client'

import { useMemo } from 'react'
import {
  useProposals,
  useCoverageGaps,
} from '@/lib/use-mock-store'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useRuns } from '@/features/runs/hooks/use-runs'
import { MOCK_NOW } from '@/lib/mock-data'
import type {
  ProjectListItem,
  RunSummaryRecord,
  ExtractedProposal,
} from '@qably/types'

export interface DashboardStats {
  totalProjects: number
  totalSuites: number
  totalRuns: number
  runsLast7d: number
  pendingProposals: number
  passRateLast7d: number
  passRateTrend: number
  coverageGapsCount: number
  activeRuns: number
  projectsByHealth: Array<{ project: ProjectListItem }>
  recentRuns: RunSummaryRecord[]
  recentProposals: ExtractedProposal[]
  recentCiRuns: RunSummaryRecord[]
}

const MS_7D = 7 * 24 * 60 * 60 * 1000

export function useDashboardStats(): DashboardStats {
  const { projects } = useProjects()
  const { runs } = useRuns()
  const proposals = useProposals()
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
            (recentFinished.reduce((sum, r) => sum + r.passRate, 0) /
              recentFinished.length) *
              100,
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
            (priorFinished.reduce((sum, r) => sum + r.passRate, 0) /
              priorFinished.length) *
              100,
          )
        : 0
    const passRateTrend = passRateLast7d - priorRate

    // Pending proposals (all projects)
    const pendingProposals = proposals.filter(
      (p) => p.status === 'in_review',
    ).length

    // Projects by health
    const projectsByHealth = projects.map((p) => ({ project: p }))

    // Recent runs: top 5 by startedAt desc
    const recentRuns = [...runs]
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, 5)

    // Recent proposals: top 5 in_review by title (stable sort for determinism)
    const recentProposals = [...proposals]
      .filter((p) => p.status === 'in_review')
      .sort((a, b) => a.title.localeCompare(b.title))
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
      pendingProposals,
      passRateLast7d,
      passRateTrend,
      coverageGapsCount: coverageGaps.length,
      activeRuns,
      projectsByHealth,
      recentRuns,
      recentProposals,
      recentCiRuns,
    }
  }, [projects, runs, proposals, coverageGaps])
}
