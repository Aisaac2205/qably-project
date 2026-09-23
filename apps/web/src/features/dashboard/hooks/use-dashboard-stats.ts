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

export interface DashboardAsyncState {
  isLoading: boolean
  isError: boolean
  retry: () => void
}

export interface DashboardStats {
  totalProjects: number
  totalSuites: number
  totalRuns: number
  runsLast7d: number
  windowDays: number
  pendingProposals: number
  passRateLast7d: number
  passRateTrend: number
  defectsDetected: number
  activeRuns: number
  projectsByHealth: Array<{ project: ProjectListItem }>
  recentRuns: RunSummaryRecord[]
  recentProposals: ExtractedProposal[]
  recentCiCommits: CiCommitActivityRecord[]
  summaryState: DashboardAsyncState
  projectsState: DashboardAsyncState
  proposalsState: DashboardAsyncState
}

const RECENT_PROPOSALS_LIMIT = 5

export function useDashboardStats(): DashboardStats {
  const projectsQuery = useProjects()
  const summaryQuery = useDashboardSummary()
  const proposalsQuery = useProposals()
  const { projects } = projectsQuery
  const { summary } = summaryQuery
  const { proposals } = proposalsQuery

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
      passRateLast7d:
        summary?.passRate != null ? Math.round(summary.passRate * 100) : 0,
      passRateTrend:
        summary?.passRateTrend != null ? Math.round(summary.passRateTrend * 100) : 0,
      defectsDetected: summary?.defectsDetected ?? 0,
      activeRuns: summary?.activeRuns ?? 0,
      projectsByHealth: projects.map((project) => ({ project })),
      recentRuns: summary?.recentRuns ?? [],
      recentProposals,
      recentCiCommits: summary?.recentCiCommits ?? [],
      summaryState: {
        isLoading: summaryQuery.isLoading,
        isError: summaryQuery.isError,
        retry: () => {
          void summaryQuery.refetch()
        },
      },
      projectsState: {
        isLoading: projectsQuery.isLoading,
        isError: projectsQuery.isError,
        retry: () => {
          void projectsQuery.refetch()
        },
      },
      proposalsState: {
        isLoading: proposalsQuery.isLoading,
        isError: proposalsQuery.isError,
        retry: () => {
          void proposalsQuery.refetch()
        },
      },
    }
  }, [projects, summary, proposals, summaryQuery, projectsQuery, proposalsQuery])
}
