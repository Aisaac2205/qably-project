'use client'

import { useMemo } from 'react'
import {
  useProposals,
  useCoverageGaps,
} from '@/lib/use-mock-store'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useDashboardSummary } from './use-dashboard-summary'
import type {
  CiCommitActivityRecord,
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
  recentCiCommits: CiCommitActivityRecord[]
}

export function useDashboardStats(): DashboardStats {
  const { projects } = useProjects()
  const { summary } = useDashboardSummary()
  const proposals = useProposals()
  const coverageGaps = useCoverageGaps()

  return useMemo(() => {
    // Pending proposals (all projects) — Review/AI domain, still mock.
    const pendingProposals = proposals.filter(
      (p) => p.status === 'in_review',
    ).length

    // Projects by health — real, api-backed, unaffected by this endpoint.
    const projectsByHealth = projects.map((p) => ({ project: p }))

    // Recent proposals: top 5 in_review by title (stable sort for determinism)
    const recentProposals = [...proposals]
      .filter((p) => p.status === 'in_review')
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 5)

    return {
      totalProjects: summary?.totalProjects ?? 0,
      totalSuites: summary?.totalSuites ?? 0,
      totalRuns: summary?.totalRuns ?? 0,
      runsLast7d: summary?.runsInWindow ?? 0,
      pendingProposals,
      passRateLast7d: summary ? Math.round(summary.passRate * 100) : 0,
      passRateTrend: summary ? Math.round(summary.passRateTrend * 100) : 0,
      coverageGapsCount: coverageGaps.length,
      activeRuns: summary?.activeRuns ?? 0,
      projectsByHealth,
      recentRuns: summary?.recentRuns ?? [],
      recentProposals,
      recentCiCommits: summary?.recentCiCommits ?? [],
    }
  }, [projects, summary, proposals, coverageGaps])
}
