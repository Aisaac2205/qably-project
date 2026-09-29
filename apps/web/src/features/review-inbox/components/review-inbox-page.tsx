'use client'

import { useMemo, useCallback, useEffect, useRef } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { BackButton } from '@/components/ui/back-button'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { StateView } from '@/components/ui/state-view'
import { cn } from '@/lib/utils'
import { useInboxPage } from '../hooks/use-inbox-page'
import { useInboxCounts } from '../hooks/use-inbox-counts'
import { useProposalDecision, decisionErrorKey } from '../hooks/use-proposal-decision'
import { decisionConflictMessageKey, isApprovalConflictCode } from '../lib/decision-error'
import { useReviewInboxFilters } from '../hooks/use-review-inbox-filters'
import { useReviewInboxSelection } from '../hooks/use-review-inbox-selection'
import { useInboxFeedback } from '../hooks/use-inbox-feedback'
import type { ReviewInboxStatusCounts } from './review-inbox-queue'
import { useTranslation } from '@/lib/i18n'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'
import { suiteEditCasePath } from '@/features/projects/lib/routes'
import { useKeyboardShortcuts } from '@/features/runs/hooks/use-keyboard-shortcuts'
import { ReviewInboxQueue } from './review-inbox-queue'
import { ReviewProposalInspector } from './review-proposal-inspector'
import { ReviewInboxFeedback } from './review-inbox-feedback'
import { ReviewInboxErrorList } from './review-inbox-error-list'
import { InboxCollisionsNotice } from './inbox-collisions-notice'

interface DecidedProposal {
  projectId: string
  title: string
}

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

  const { counts, openCollisions } = useInboxCounts({
    projectId: selectedProjectId,
    search,
  })

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
    reselectAfterFailure,
    closeDetail,
    selectNextPending,
    isDetailOpenOnMobile,
    position,
    goToPrevious,
    goToNext,
  } = selection

  const lastOpenedRowIdRef = useRef<string | undefined>(undefined)
  const decidedProposalsRef = useRef(new Map<string, DecidedProposal>())

  const handleSelectFromList = useCallback(
    (id: string) => {
      lastOpenedRowIdRef.current = id
      selectFromList(id)
    },
    [selectFromList],
  )

  const { approve, reject, isDeciding } = useProposalDecision({
    onApproved: (proposalId, result) => {
      const decided = decidedProposalsRef.current.get(proposalId)
      feedback.clearError(proposalId)
      feedback.showSuccess(
        t('reviewInbox.approvedWithCase', { caseName: result.testCaseName }),
        decided && result.suiteId
          ? {
              href: `/projects/${decided.projectId}/suites/${result.suiteId}`,
              linkLabel: t('reviewInbox.viewCase'),
            }
          : undefined,
      )
    },
    onRejected: (proposalId) => {
      feedback.clearError(proposalId)
      feedback.showInfo(t('reviewInbox.rejectedSuccess'))
    },
    onError: (code, proposalId, conflict, conflictingCase) => {
      if (code === 'invalid-transition' && conflict !== null) {
        feedback.showError(
          t(`aiReview.${decisionConflictMessageKey(conflict.action)}`, {
            name: conflict.decidedBy.name,
            time: formatRelative(conflict.decidedAt, locale, ''),
          }),
          { key: proposalId },
        )
        return
      }

      const decided = decidedProposalsRef.current.get(proposalId)
      const link =
        conflictingCase !== null && decided !== undefined
          ? {
              href: suiteEditCasePath(decided.projectId, conflictingCase.suiteId, conflictingCase.id),
              linkLabel: t('reviewInbox.viewExistingCase'),
            }
          : undefined

      feedback.showError(
        t(`aiReview.${decisionErrorKey(code, conflictingCase)}`, {
          title: decided?.title ?? '',
          name: conflictingCase?.name ?? '',
        }),
        { key: proposalId, link },
      )

      if (isApprovalConflictCode(code)) reselectAfterFailure(proposalId)
    },
  })

  const rememberDecidedProposal = useCallback(
    (proposalId: string): boolean => {
      const proposal =
        selectedProposal?.id === proposalId
          ? selectedProposal
          : proposals.find((p) => p.id === proposalId)
      if (proposal === undefined) return false
      decidedProposalsRef.current.set(proposalId, {
        projectId: proposal.projectId,
        title: proposal.title,
      })
      feedback.clearError(proposalId)
      return true
    },
    [selectedProposal, proposals, feedback],
  )

  const handleApprove = useCallback(
    (proposalId: string) => {
      if (!rememberDecidedProposal(proposalId)) return
      approve(proposalId)
      selectNextPending()
    },
    [rememberDecidedProposal, approve, selectNextPending],
  )
  const handleReject = useCallback(
    (proposalId: string) => {
      if (!rememberDecidedProposal(proposalId)) return
      reject(proposalId)
      selectNextPending()
    },
    [rememberDecidedProposal, reject, selectNextPending],
  )

  const toggleDuplicateOnly = useCallback(() => {
    const next = !filters.duplicateOnly
    filters.setDuplicateOnly(next)
    feedback.showInfo(next ? t('reviewInbox.duplicateFilterEnabled') : t('reviewInbox.duplicateFilterDisabled'))
  }, [filters, feedback, t])

  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const queueSectionRef = useRef<HTMLElement>(null)
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

  useKeyboardShortcuts({
    a: () => {
      if (selectedProposal?.status === 'in_review') handleApprove(selectedProposal.id)
    },
    r: () => {
      if (selectedProposal?.status === 'in_review') handleReject(selectedProposal.id)
    },
    d: () => toggleDuplicateOnly(),
  })

  const { notice } = feedback

  return (
    <section
      aria-labelledby="page-title"
      className="flex h-full min-h-0 w-full flex-col gap-4 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6"
    >
      <h1 id="page-title" className="sr-only">{t('sidebar.reviewInbox')}</h1>

      <div className="shrink-0 space-y-4 empty:hidden">
        <InboxCollisionsNotice openCollisions={openCollisions} />
        <ReviewInboxErrorList errors={feedback.errors} onDismiss={feedback.dismissMany} />
        {notice ? (
          <ReviewInboxFeedback
            key={notice.id}
            toast={notice}
            onDismiss={() => feedback.dismiss(notice.id)}
          />
        ) : null}
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
                    <BackButton onClick={closeDetail} label={t('reviewInbox.backToQueue')} />

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
