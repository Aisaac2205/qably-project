'use client'

import { useMemo, useCallback, useEffect, useRef } from 'react'
import { CaretLeft, CaretRight, ArrowLeft } from '@phosphor-icons/react'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { StateView } from '@/components/ui/state-view'
import { cn } from '@/lib/utils'
import { useInboxPage } from '../hooks/use-inbox-page'
import { useInboxCounts } from '../hooks/use-inbox-counts'
import { useProposalDecision, decisionErrorKey } from '../hooks/use-proposal-decision'
import { decisionConflictMessageKey } from '../lib/decision-error'
import { useReviewInboxFilters } from '../hooks/use-review-inbox-filters'
import { useReviewInboxSelection } from '../hooks/use-review-inbox-selection'
import { useInboxFeedback } from '../hooks/use-inbox-feedback'
import type { ReviewInboxStatusCounts } from './review-inbox-queue'
import { useTranslation } from '@/lib/i18n'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'
import { useKeyboardShortcuts } from '@/features/runs/hooks/use-keyboard-shortcuts'
import { ReviewInboxQueue } from './review-inbox-queue'
import { ReviewProposalInspector } from './review-proposal-inspector'
import { ReviewInboxFeedback } from './review-inbox-feedback'

export function ReviewInboxPage() {
  const { t, locale } = useTranslation()
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
  const fetchNextPageVoid = useCallback(() => void fetchNextPage(), [fetchNextPage])

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

  const selection = useReviewInboxSelection(proposals, proposals, {
    hasNextPage,
    fetchNextPage: fetchNextPageVoid,
  })
  const {
    activeSelectedId,
    selectedProposal,
    selectFromList,
    closeDetail,
    selectNextPending,
    isDetailOpenOnMobile,
    position,
    goToPrevious,
    goToNext,
  } = selection

  const { approve, reject, isDeciding } = useProposalDecision({
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
    },
    onRejected: () => {
      feedback.showInfo(t('reviewInbox.rejectedSuccess'))
    },
    onError: (code, _proposalId, conflict) => {
      if (code === 'invalid-transition' && conflict !== null) {
        feedback.showError(
          t(`aiReview.${decisionConflictMessageKey(conflict.action)}`, {
            name: conflict.decidedBy.name,
            time: formatRelative(conflict.decidedAt, locale, ''),
          }),
        )
        return
      }
      feedback.showError(t(`aiReview.${decisionErrorKey(code)}`))
    },
  })

  const handleApprove = useCallback(
    (proposalId: string) => {
      approve(proposalId)
      selectNextPending()
    },
    [approve, selectNextPending],
  )
  const handleReject = useCallback(
    (proposalId: string) => {
      reject(proposalId)
      selectNextPending()
    },
    [reject, selectNextPending],
  )

  const toggleDuplicateOnly = useCallback(() => {
    const next = !filters.duplicateOnly
    filters.setDuplicateOnly(next)
    feedback.showInfo(next ? t('reviewInbox.duplicateFilterEnabled') : t('reviewInbox.duplicateFilterDisabled'))
  }, [filters, feedback, t])

  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const queueSectionRef = useRef<HTMLElement>(null)
  const lastOpenedRowIdRef = useRef<string | undefined>(undefined)
  const wasDetailOpenOnMobileRef = useRef(isDetailOpenOnMobile)

  useEffect(() => {
    if (wasDetailOpenOnMobileRef.current === isDetailOpenOnMobile) return
    wasDetailOpenOnMobileRef.current = isDetailOpenOnMobile

    if (isDetailOpenOnMobile) {
      detailHeadingRef.current?.focus()
      return
    }

    const originatingRow =
      lastOpenedRowIdRef.current === undefined
        ? null
        : document.getElementById(`review-queue-row-${lastOpenedRowIdRef.current}`)
    if (originatingRow) originatingRow.focus()
    else queueSectionRef.current?.focus()
  }, [isDetailOpenOnMobile])

  const handleSelectFromList = useCallback(
    (id: string) => {
      lastOpenedRowIdRef.current = id
      selectFromList(id)
    },
    [selectFromList],
  )

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
              ref={queueSectionRef}
              tabIndex={-1}
              aria-label={t('reviewInbox.queueTitle')}
              className={cn(
                'h-full min-h-0 flex-col bg-surface outline-none md:flex',
                isDetailOpenOnMobile ? 'hidden' : 'flex',
              )}
            >
              <ReviewInboxQueue
                proposals={proposals}
                selectedId={activeSelectedId}
                onSelect={handleSelectFromList}
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
                onLoadMore={fetchNextPageVoid}
              />
            </section>
          }
          second={
            <section
              aria-label={t('reviewInbox.inspectorTitle')}
              className={cn(
                'h-full min-h-0 flex-col border-t border-border bg-surface md:flex md:border-t-0',
                isDetailOpenOnMobile ? 'flex' : 'hidden',
              )}
            >
              {selectedProposal ? (
                <>
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5 md:hidden">
                    <button
                      type="button"
                      onClick={closeDetail}
                      aria-label={t('reviewInbox.backToQueue')}
                      className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-medium text-muted transition-colors hover:text-default"
                    >
                      <ArrowLeft size={18} aria-hidden="true" />
                      {t('reviewInbox.backToQueue')}
                    </button>

                    {position && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={goToPrevious}
                          disabled={position.index <= 1}
                          aria-label={t('reviewInbox.previousProposal')}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-muted transition-colors hover:text-default disabled:opacity-30"
                        >
                          <CaretLeft size={16} aria-hidden="true" />
                        </button>
                        <span className="px-1 text-xs tabular-nums text-muted">
                          {t('reviewInbox.positionOfTotal', {
                            index: position.index,
                            count: position.total,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={goToNext}
                          disabled={position.index >= position.total}
                          aria-label={t('reviewInbox.nextProposal')}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-muted transition-colors hover:text-default disabled:opacity-30"
                        >
                          <CaretRight size={16} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>

                  <ReviewProposalInspector
                    proposal={selectedProposal}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isSubmitting={isDeciding(selectedProposal.id)}
                    headingRef={detailHeadingRef}
                  />
                </>
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
