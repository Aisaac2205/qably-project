'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, Info, X } from '@phosphor-icons/react'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { StateView } from '@/components/ui/state-view'
import { useProposals } from '../hooks/use-proposals'
import { useProposalDecision } from '../hooks/use-proposal-decision'
import { useBulkProposalDecision } from '../hooks/use-bulk-proposal-decision'
import { useSuiteProposalDecision, useSuiteProposals } from '../hooks/use-suite-proposals'
import { SuiteProposalsPanel } from './suite-proposals-panel'
import { bulkDecisionReasonKey, summarizeBulkResults } from '../lib/bulk-decision-reason'
import type { BulkDecisionItemResult } from '../api/review.api'
import { useTranslation } from '@/lib/i18n'
import { useKeyboardShortcuts } from '@/features/runs/hooks/use-keyboard-shortcuts'
import { ReviewInboxQueue, type ReviewQueueStatusFilter } from './review-inbox-queue'
import { ReviewProposalInspector } from './review-proposal-inspector'

export function ReviewInboxPage() {
  const { t } = useTranslation()
  const { proposals } = useProposals()
  const searchParams = useSearchParams()

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const { suiteProposals } = useSuiteProposals(selectedProjectId)
  const [statusFilter, setStatusFilter] = useState<ReviewQueueStatusFilter>('in_review')
  const [duplicateOnly, setDuplicateOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => searchParams.get('proposal') ?? undefined,
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [feedbackToast, setFeedbackToast] = useState<{
    message: string
    type: 'success' | 'info'
    href?: string
    linkLabel?: string
  } | null>(null)

  const suiteDecision = useSuiteProposalDecision((decision, action) => {
    if (action === 'reject') {
      setFeedbackToast({ message: t('reviewInbox.suiteProposalRejected'), type: 'info' })
      return
    }
    setFeedbackToast({
      message: decision.applied
        ? t('reviewInbox.suiteProposalApplied', { name: decision.suiteName })
        : t('reviewInbox.suiteProposalRecorded'),
      type: decision.applied ? 'success' : 'info',
      href: `/projects/${decision.projectId}/suites/${decision.suiteId}`,
      linkLabel: t('reviewInbox.viewCase'),
    })
  })

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (selectedProjectId !== 'all' && p.projectId !== selectedProjectId) return false
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (duplicateOnly && !p.targetOfficialTestCaseId) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        return p.title.toLowerCase().includes(q) || p.objective.toLowerCase().includes(q)
      }
      return true
    })
  }, [proposals, selectedProjectId, statusFilter, duplicateOnly, searchQuery])

  const activeSelectedId =
    selectedId !== undefined && proposals.some((p) => p.id === selectedId)
      ? selectedId
      : filteredProposals[0]?.id
  const selectedProposal = proposals.find((p) => p.id === activeSelectedId)

  const selectNextPending = useCallback(() => {
    const remainingPending = filteredProposals.filter(
      (p) => p.id !== activeSelectedId && p.status === 'in_review',
    )
    if (remainingPending.length > 0) {
      setSelectedId(remainingPending[0].id)
    }
  }, [activeSelectedId, filteredProposals])

  const { approve, reject } = useProposalDecision({
    onApproved: (proposalId, result) => {
      const proposal = proposals.find((p) => p.id === proposalId)
      setFeedbackToast({
        message: t('reviewInbox.approvedWithCase', { caseName: result.testCaseName }),
        type: 'success',
        ...(proposal && result.suiteId
          ? {
              href: `/projects/${proposal.projectId}/suites/${result.suiteId}`,
              linkLabel: t('reviewInbox.viewCase'),
            }
          : {}),
      })
      selectNextPending()
    },
    onRejected: () => {
      setFeedbackToast({
        message: t('reviewInbox.rejectedSuccess'),
        type: 'info',
      })
      selectNextPending()
    },
  })

  const handleApprove = useCallback(
    (proposalId: string) => {
      approve(proposalId)
    },
    [approve],
  )

  const handleReject = useCallback(
    (proposalId: string) => {
      reject(proposalId)
    },
    [reject],
  )

  const toggleDuplicateOnly = useCallback(() => {
    setDuplicateOnly((prev) => {
      const next = !prev
      setFeedbackToast({
        message: next ? t('reviewInbox.duplicateFilterEnabled') : t('reviewInbox.duplicateFilterDisabled'),
        type: 'info',
      })
      return next
    })
    setSelectedIds(new Set())
  }, [t])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }, [])

  const buildBulkSummary = useCallback(
    (results: BulkDecisionItemResult[], kind: 'approve' | 'reject') => {
      const summary = summarizeBulkResults(results)
      const base = t(kind === 'approve' ? 'reviewInbox.bulkApproveSummary' : 'reviewInbox.bulkRejectSummary', {
        approved: summary.succeeded,
        rejected: summary.succeeded,
        skipped: summary.skipped,
      })
      const reasons = summary.skippedByReason
        .map(({ reason, count }) =>
          t('reviewInbox.bulkSkipReason', { count, reason: t(`reviewInbox.${bulkDecisionReasonKey(reason)}`) }),
        )
        .join(', ')

      return reasons ? `${base} (${reasons})` : base
    },
    [t],
  )

  const { approveMany, rejectMany, isApproving: isBulkApproving, isRejecting: isBulkRejecting } =
    useBulkProposalDecision({
      onApproved: (results) => {
        setFeedbackToast({ message: buildBulkSummary(results, 'approve'), type: 'success' })
        setSelectedIds(new Set())
      },
      onRejected: (results) => {
        setFeedbackToast({ message: buildBulkSummary(results, 'reject'), type: 'info' })
        setSelectedIds(new Set())
      },
    })

  const handleBulkApprove = useCallback(
    (ids: string[]) => {
      approveMany(ids)
    },
    [approveMany],
  )

  const handleBulkReject = useCallback(
    (ids: string[]) => {
      rejectMany(ids)
    },
    [rejectMany],
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
        <SuiteProposalsPanel
          proposals={suiteProposals}
          isDeciding={suiteDecision.isDeciding}
          onApprove={suiteDecision.approve}
          onReject={suiteDecision.reject}
        />
        {feedbackToast && (
          <div
            role="status"
            className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-xs font-medium transition-all duration-200 ${
              feedbackToast.type === 'success'
                ? 'border-pass/40 bg-pass-bg/20 text-pass'
                : 'border-border bg-surface text-default'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {feedbackToast.type === 'success' ? (
                <CheckCircle size={16} weight="fill" aria-hidden="true" />
              ) : (
                <Info size={16} weight="fill" aria-hidden="true" />
              )}
              <span className="truncate">{feedbackToast.message}</span>
              {feedbackToast.href && (
                <Link
                  href={feedbackToast.href}
                  className="font-semibold underline hover:text-primary shrink-0"
                >
                  {feedbackToast.linkLabel}
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFeedbackToast(null)}
              aria-label={t('common.cancel')}
              className="rounded p-1 hover:bg-canvas text-muted hover:text-default transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
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
                selectedProjectId={selectedProjectId}
                onSelectProject={(id) => {
                  setSelectedProjectId(id)
                  setSelectedIds(new Set())
                }}
                statusFilter={statusFilter}
                onStatusFilterChange={(s) => {
                  setStatusFilter(s)
                  setSelectedIds(new Set())
                }}
                duplicateOnly={duplicateOnly}
                onToggleDuplicateOnly={toggleDuplicateOnly}
                searchQuery={searchQuery}
                onSearchQueryChange={(q) => {
                  setSearchQuery(q)
                  setSelectedIds(new Set())
                }}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
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
