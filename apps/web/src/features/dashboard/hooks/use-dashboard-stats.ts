'use client'

import { useMemo } from 'react'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useProposals } from '@/features/review-inbox/hooks/use-proposals'
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
  windowDays: number
  pendingProposals: number
  passRateLast7d: number
  passRateTrend: number
  activeRuns: number
  projectsByHealth: Array<{ project: ProjectListItem }>
  recentRuns: RunSummaryRecord[]
  recentProposals: ExtractedProposal[]
  recentCiCommits: CiCommitActivityRecord[]
}

const RECENT_PROPOSALS_LIMIT = 5

export function useDashboardStats(): DashboardStats {
  const { projects } = useProjects()
  const { summary } = useDashboardSummary()
  const { proposals } = useProposals()

  return useMemo(() => {
    const inReview = proposals.filter((proposal) => proposal.status === 'in_review')
    const recentProposals = [...inReview]
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, RECENT_PROPOSALS_LIMIT)

    return {
      totalProjects: summary?.totalProjects ?? 0,
      totalSuites: summary?.totalSuites ?? 0,
      totalRuns: summary?.totalRuns ?? 0,
      runsLast7d: summary?.runsInWindow ?? 0,
      windowDays: summary?.windowDays ?? 7,
      pendingProposals: inReview.length,
      passRateLast7d: summary ? Math.round(summary.passRate * 100) : 0,
      passRateTrend: summary ? Math.round(summary.passRateTrend * 100) : 0,
      activeRuns: summary?.activeRuns ?? 0,
      projectsByHealth: projects.map((project) => ({ project })),
      recentRuns: summary?.recentRuns ?? [],
      recentProposals,
      recentCiCommits: summary?.recentCiCommits ?? [],
    }
  }, [projects, summary, proposals])
}
