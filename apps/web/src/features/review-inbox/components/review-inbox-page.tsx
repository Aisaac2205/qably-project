'use client'

import { useMemo, useCallback } from 'react'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { StateView } from '@/components/ui/state-view'
import { useProposals } from '../hooks/use-proposals'
import { useProposalDecision, decisionErrorKey } from '../hooks/use-proposal-decision'
import { useBulkProposalDecision } from '../hooks/use-bulk-proposal-decision'
import { useReviewInboxFilters } from '../hooks/use-review-inbox-filters'
import { useReviewInboxSelection } from '../hooks/use-review-inbox-selection'
import { useBulkSelection } from '../hooks/use-bulk-selection'
import { useInboxFeedback } from '../hooks/use-inbox-feedback'
import { formatBulkSummary } from '../lib/bulk-decision-reason'
import { useTranslation } from '@/lib/i18n'
import { useKeyboardShortcuts } from '@/features/runs/hooks/use-keyboard-shortcuts'
import { ReviewInboxQueue } from './review-inbox-queue'
import { ReviewProposalInspector } from './review-proposal-inspector'
import { ReviewInboxFeedback } from './review-inbox-feedback'

export function ReviewInboxPage() {
  const { t } = useTranslation()
  const { proposals } = useProposals()

  const filters = useReviewInboxFilters()
  const bulkSelection = useBulkSelection()
  const feedback = useInboxFeedback()

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (filters.selectedProjectId !== 'all' && p.projectId !== filters.selectedProjectId) return false
      if (filters.statusFilter !== 'all' && p.status !== filters.statusFilter) return false
      if (filters.duplicateOnly && p.possibleDuplicate !== true) return false
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase().trim()
        return p.title.toLowerCase().includes(q) || p.objective.toLowerCase().includes(q)
      }
      return true
    })
  }, [proposals, filters.selectedProjectId, filters.statusFilter, filters.duplicateOnly, filters.searchQuery])

  const { activeSelectedId, selectedProposal, setSelectedId, selectNextPending } = useReviewInboxSelection(
    proposals,
    filteredProposals,
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
    bulkSelection.clear()
  }, [filters, feedback, bulkSelection, t])

  const { approveMany, rejectMany, isApproving: isBulkApproving, isRejecting: isBulkRejecting } =
    useBulkProposalDecision({
      onApproved: (results) => {
        feedback.showSuccess(formatBulkSummary(t, results, 'approve'))
        bulkSelection.clear()
      },
      onRejected: (results) => {
        feedback.showInfo(formatBulkSummary(t, results, 'reject'))
        bulkSelection.clear()
      },
    })

  const handleBulkApprove = useCallback((ids: string[]) => approveMany(ids), [approveMany])
  const handleBulkReject = useCallback((ids: string[]) => rejectMany(ids), [rejectMany])

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
                onSelectProject={(id) => {
                  filters.setSelectedProjectId(id)
                  bulkSelection.clear()
                }}
                statusFilter={filters.statusFilter}
                onStatusFilterChange={(s) => {
                  filters.setStatusFilter(s)
                  bulkSelection.clear()
                }}
                duplicateOnly={filters.duplicateOnly}
                onToggleDuplicateOnly={toggleDuplicateOnly}
                searchQuery={filters.searchQuery}
                onSearchQueryChange={(q) => {
                  filters.setSearchQuery(q)
                  bulkSelection.clear()
                }}
                selectedIds={bulkSelection.selectedIds}
                onToggleSelect={bulkSelection.toggle}
                onToggleSelectAll={bulkSelection.toggleAll}
                onBulkApprove={handleBulkApprove}
                onBulkReject={handleBulkReject}
                isBulkApproving={isBulkApproving}
                isBulkRejecting={isBulkRejecting}
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
