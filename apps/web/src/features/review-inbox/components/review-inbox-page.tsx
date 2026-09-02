'use client'

import { useState, useMemo } from 'react'
import { CheckCircle, Info, X } from '@phosphor-icons/react'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { StateView } from '@/components/ui/state-view'
import { useProposals } from '@/lib/use-mock-store'
import { approveProposal, rejectProposal } from '@/lib/mock-store'
import { useTranslation } from '@/lib/i18n'
import { ReviewKpiRow } from './review-kpi-row'
import { ReviewGovernanceBanner } from './review-governance-banner'
import { ReviewInboxQueue, type ReviewQueueStatusFilter } from './review-inbox-queue'
import { ReviewProposalInspector } from './review-proposal-inspector'
import { RecentReviewDecisions } from './recent-review-decisions'
import { ProjectReviewDistribution } from './project-review-distribution'

export function ReviewInboxPage() {
  const { t } = useTranslation()
  const proposals = useProposals()

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<ReviewQueueStatusFilter>('in_review')
  const [duplicateOnly, setDuplicateOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null)

  // Compute active filtered proposals to resolve default selected proposal
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

  // Active selected proposal
  const activeSelectedId = selectedId || (filteredProposals.length > 0 ? filteredProposals[0].id : undefined)
  const selectedProposal = proposals.find((p) => p.id === activeSelectedId)

  const handleApprove = (proposalId: string) => {
    const res = approveProposal(proposalId, {
      actorId: 'QA Reviewer',
      comment: 'Approved for suite publication from Review Inbox',
    })
    if (res.ok) {
      setFeedbackToast({
        message: t('reviewInbox.approvedSuccess'),
        type: 'success',
      })
      // Move to next pending if available
      const remainingPending = filteredProposals.filter((p) => p.id !== proposalId && p.status === 'in_review')
      if (remainingPending.length > 0) {
        setSelectedId(remainingPending[0].id)
      }
    }
  }

  const handleReject = (proposalId: string) => {
    const res = rejectProposal(proposalId, {
      actorId: 'QA Reviewer',
      comment: 'Rejected from Review Inbox',
    })
    if (res.ok) {
      setFeedbackToast({
        message: t('reviewInbox.rejectedSuccess'),
        type: 'info',
      })
      const remainingPending = filteredProposals.filter((p) => p.id !== proposalId && p.status === 'in_review')
      if (remainingPending.length > 0) {
        setSelectedId(remainingPending[0].id)
      }
    }
  }

  return (
    <section
      aria-label={t('reviewInbox.title')}
      className="w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6"
    >
      <h1 className="sr-only">{t('reviewInbox.title')}</h1>

      <ReviewGovernanceBanner />

      {/* Optional feedback banner */}
      {feedbackToast && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-xs font-medium transition-all duration-200 ${
            feedbackToast.type === 'success'
              ? 'border-pass/40 bg-pass-bg/20 text-pass'
              : 'border-border bg-surface text-default'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackToast.type === 'success' ? (
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
            ) : (
              <Info size={16} weight="fill" aria-hidden="true" />
            )}
            <span>{feedbackToast.message}</span>
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

      {/* KPI Overview Row */}
      <ReviewKpiRow />

      {/* Main Review Workspace Split */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden min-h-[600px] h-[720px] max-h-[85vh]">
        <ResizableSplit
          storageKey="review-inbox-split"
          defaultWidth={340}
          minWidth={280}
          maxRatio={0.55}
          className="h-full"
          first={
            <div className="h-full flex flex-col min-h-0 bg-surface">
              <ReviewInboxQueue
                proposals={proposals}
                selectedId={activeSelectedId}
                onSelect={(id) => setSelectedId(id)}
                selectedProjectId={selectedProjectId}
                onSelectProject={(id) => setSelectedProjectId(id)}
                statusFilter={statusFilter}
                onStatusFilterChange={(s) => setStatusFilter(s)}
                duplicateOnly={duplicateOnly}
                onToggleDuplicateOnly={() => setDuplicateOnly((prev) => !prev)}
                searchQuery={searchQuery}
                onSearchQueryChange={(q) => setSearchQuery(q)}
              />
            </div>
          }
          second={
            <div className="h-full flex flex-col min-h-0 bg-surface">
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
            </div>
          }
        />
      </div>

      {/* Secondary Analytics: Distribution & Audit History */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(21rem,0.9fr)]">
        <ProjectReviewDistribution
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId)
            setStatusFilter('in_review')
          }}
        />
        <RecentReviewDecisions />
      </div>
    </section>
  )
}
