'use client'

import { useMemo, useCallback } from 'react'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { StateView } from '@/components/ui/state-view'
import { useInboxPage } from '../hooks/use-inbox-page'
import { useInboxCounts } from '../hooks/use-inbox-counts'
import { useProposalDecision, decisionErrorKey } from '../hooks/use-proposal-decision'
import { useReviewInboxFilters } from '../hooks/use-review-inbox-filters'
import { useReviewInboxSelection } from '../hooks/use-review-inbox-selection'
import { useInboxFeedback } from '../hooks/use-inbox-feedback'
import type { ReviewInboxStatusCounts } from './review-inbox-queue'
import { useTranslation } from '@/lib/i18n'
import { useKeyboardShortcuts } from '@/features/runs/hooks/use-keyboard-shortcuts'
import { ReviewInboxQueue } from './review-inbox-queue'
import { ReviewProposalInspector } from './review-proposal-inspector'
import { ReviewInboxFeedback } from './review-inbox-feedback'

export function ReviewInboxPage() {
  const { t } = useTranslation()
  const filters = useReviewInboxFilters()
  const feedback = useInboxFeedback()

  const selectedProjectId =
    filters.selectedProjectId === 'all' ? undefined : filters.selectedProjectId
  const search = filters.searchQuery.trim() === '' ? undefined : filters.searchQuery

  const { proposals, hasNextPage, isFetchingNextPage, fetchNextPage } = useInboxPage({
    projectId: selectedProjectId,
    status: filters.statusFilter,
    duplicatesOnly: filters.duplicateOnly || undefined,
    search,
  })

  const { counts } = useInboxCounts({ projectId: selectedProjectId, search })

  const statusCounts: ReviewInboxStatusCounts = useMemo(
    () => ({
      in_review: counts.in_review,
      approved: counts.approved,
      rejected: counts.rejected,
      all: counts.in_review + counts.approved + counts.rejected + counts.changes_requested,
    }),
    [counts],
  )

  const { activeSelectedId, selectedProposal, setSelectedId, selectNextPending } = useReviewInboxSelection(
    proposals,
    proposals,
  )

  const { approve, reject } = useProposalDecision({
    onApproved: (proposalId, result) => {
      const proposal = proposals.find((p) => p.id === proposalId)
      feedback.showSuccess(
        t('reviewInbox.approvedWithCase', { caseName: result.testCaseName }),
        proposal && result.suiteId
          ? {
              href: `/projects/${proposal.projectId}/suites/${result.suiteId}`,
              linkLabel: t('reviewInbox.viewCase'),
            }
          : undefined,
      )
      selectNextPending()
    },
    onRejected: () => {
      feedback.showInfo(t('reviewInbox.rejectedSuccess'))
      selectNextPending()
    },
    onError: (code) => {
      feedback.showError(t(`aiReview.${decisionErrorKey(code)}`))
    },
  })

  const handleApprove = useCallback((proposalId: string) => approve(proposalId), [approve])
  const handleReject = useCallback((proposalId: string) => reject(proposalId), [reject])

  const toggleDuplicateOnly = useCallback(() => {
    const next = !filters.duplicateOnly
    filters.setDuplicateOnly(next)
    feedback.showInfo(next ? t('reviewInbox.duplicateFilterEnabled') : t('reviewInbox.duplicateFilterDisabled'))
  }, [filters, feedback, t])

  useKeyboardShortcuts({
    a: () => {
      if (selectedProposal?.status === 'in_review') handleApprove(selectedProposal.id)
    },
    r: () => {
      if (selectedProposal?.status === 'in_review') handleReject(selectedProposal.id)
    },
    d: () => toggleDuplicateOnly(),
  })

  return (
    <section
      aria-labelledby="page-title"
      className="flex h-full min-h-0 w-full flex-col gap-4 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6"
    >
      <div className="shrink-0 space-y-4 empty:hidden">
        <ReviewInboxFeedback toast={feedback.toast} onDismiss={feedback.dismiss} />
      </div>

      <div className="min-h-0 flex-1">
        <ResizableSplit
          storageKey="review-inbox-split"
          defaultWidth={340}
          minWidth={280}
          maxRatio={0.55}
          className="h-full"
          first={
            <section
              aria-label={t('reviewInbox.queueTitle')}
              className="flex h-full min-h-0 flex-col bg-surface"
            >
              <ReviewInboxQueue
                proposals={proposals}
                selectedId={activeSelectedId}
                onSelect={(id) => setSelectedId(id)}
                selectedProjectId={filters.selectedProjectId}
                onSelectProject={filters.setSelectedProjectId}
                statusFilter={filters.statusFilter}
                onStatusFilterChange={filters.setStatusFilter}
                duplicateOnly={filters.duplicateOnly}
                onToggleDuplicateOnly={toggleDuplicateOnly}
                searchQuery={filters.searchInput}
                onSearchQueryChange={filters.setSearchQuery}
                statusCounts={statusCounts}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => void fetchNextPage()}
              />
            </section>
          }
          second={
            <section
              aria-label={t('reviewInbox.inspectorTitle')}
              className="flex h-full min-h-0 flex-col border-t border-border bg-surface md:border-t-0"
            >
              {selectedProposal ? (
                <ReviewProposalInspector
                  proposal={selectedProposal}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <StateView
                    kind="empty"
                    title={t('reviewInbox.noProposalsFound')}
                    description={t('reviewInbox.selectProposalPrompt')}
                  />
                </div>
              )}
            </section>
          }
        />
      </div>
    </section>
  )
}
