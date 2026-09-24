'use client'

import { useEffect, useRef } from 'react'
import type { ProposalListItem } from '../api/review.api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useTranslation } from '@/lib/i18n'
import { ReviewInboxFilters } from './review-inbox-filters'
import { ReviewQueueRow } from './review-queue-row'
import { ReviewShortcutsLegend } from './review-shortcuts-legend'

export type ReviewQueueStatusFilter = 'in_review' | 'all' | 'approved' | 'rejected'

export interface ReviewInboxStatusCounts {
  in_review: number
  approved: number
  rejected: number
  all: number
}

const EMPTY_STATUS_COUNTS: ReviewInboxStatusCounts = {
  in_review: 0,
  approved: 0,
  rejected: 0,
  all: 0,
}

export interface ReviewInboxQueueProps {
  proposals: ProposalListItem[]
  selectedId?: string
  onSelect: (id: string) => void
  selectedProjectId: string
  onSelectProject: (id: string) => void
  statusFilter: ReviewQueueStatusFilter
  onStatusFilterChange: (status: ReviewQueueStatusFilter) => void
  duplicateOnly: boolean
  onToggleDuplicateOnly: () => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  statusCounts?: ReviewInboxStatusCounts
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

export function ReviewInboxQueue({
  proposals,
  selectedId,
  onSelect,
  selectedProjectId,
  onSelectProject,
  statusFilter,
  onStatusFilterChange,
  duplicateOnly,
  onToggleDuplicateOnly,
  searchQuery,
  onSearchQueryChange,
  statusCounts = EMPTY_STATUS_COUNTS,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: ReviewInboxQueueProps) {
  const { t } = useTranslation()
  const { projects } = useProjects()
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasNextPage || onLoadMore === undefined) return
    const node = sentinelRef.current
    if (node === null || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting === true) onLoadMore()
    })
    observer.observe(node)

    return () => observer.disconnect()
  }, [hasNextPage, onLoadMore])

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]))

  return (
    <Card className="rounded-none border-0 h-full flex flex-col justify-between overflow-hidden bg-surface">
      <ReviewInboxFilters
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={onSelectProject}
        duplicateOnly={duplicateOnly}
        onToggleDuplicateOnly={onToggleDuplicateOnly}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        statusCounts={statusCounts}
      />

      <CardContent className="p-0 flex-1 overflow-y-auto">
        {proposals.length === 0 ? (
          <StateView
            kind="empty"
            title={t('reviewInbox.noProposalsFound')}
            description={t('reviewInbox.noProposalsDescription')}
            className="p-8 h-full"
          />
        ) : (
          <>
            <EntityList aria-label={t('reviewInbox.queueTitle')}>
              {proposals.map((proposal) => (
                <ReviewQueueRow
                  key={proposal.id}
                  proposal={proposal}
                  isSelected={proposal.id === selectedId}
                  onSelect={onSelect}
                  projectName={projectNameById.get(proposal.projectId)}
                />
              ))}
            </EntityList>

            {hasNextPage && (
              <div ref={sentinelRef} className="flex justify-center p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onLoadMore?.()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? t('reviewInbox.loadingMore') : t('reviewInbox.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <ReviewShortcutsLegend />
    </Card>
  )
}
