'use client'

import {
  MagnifyingGlass,
  Sparkle,
  CopySimple,
  CheckCircle,
  XCircle,
  Clock,
} from '@phosphor-icons/react'
import type { ExtractedProposal } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useEvidence } from '@/lib/use-mock-store'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useTranslation } from '@/lib/i18n'

export type ReviewQueueStatusFilter = 'in_review' | 'all' | 'approved' | 'rejected'

export interface ReviewInboxQueueProps {
  proposals: ExtractedProposal[]
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
}

function ReviewProposalQueueRow({
  proposal,
  isSelected,
  onSelect,
  projectName,
}: {
  proposal: ExtractedProposal
  isSelected: boolean
  onSelect: (id: string) => void
  projectName?: string
}) {
  const { t } = useTranslation()
  const evidence = useEvidence(proposal.evidenceId)

  const isPending = proposal.status === 'in_review'
  const isApproved = proposal.status === 'approved'
  const isRejected = proposal.status === 'rejected'

  return (
    <li>
      <button
        type="button"
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(proposal.id)}
        className={`w-full text-left px-3.5 py-2.5 transition-colors duration-150 hover:bg-surface-hover/70 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isSelected
            ? 'bg-surface-hover/90 border-l-4 border-l-primary'
            : 'border-l-4 border-l-transparent'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              {projectName && (
                <span className="truncate rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted">
                  {projectName}
                </span>
              )}
              {isApproved && (
                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-pass-bg text-pass">
                  <CheckCircle size={11} weight="fill" aria-hidden="true" />
                  {t('reviewInbox.decisionApproved')}
                </span>
              )}
              {isRejected && (
                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-fail-bg text-fail">
                  <XCircle size={11} weight="fill" aria-hidden="true" />
                  {t('reviewInbox.decisionRejected')}
                </span>
              )}
              {isPending && (
                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted bg-canvas">
                  <Clock size={11} aria-hidden="true" />
                  {t('status.review.pending')}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-semibold text-default truncate flex items-center gap-1.5">
              <Sparkle size={13} weight="fill" className="text-ai shrink-0" aria-hidden="true" />
              <span className="truncate">{proposal.title}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted mt-1.5">
          {proposal.targetOfficialTestCaseId && (
            <Badge variant="warn" className="text-[10px] px-1.5 py-0.5 font-medium">
              <CopySimple size={10} weight="bold" aria-hidden="true" />
              {t('reviewInbox.possibleDuplicate')}
            </Badge>
          )}
          {evidence?.title && (
            <span className="font-mono text-[11px] text-muted truncate max-w-56">
              {evidence.title}
            </span>
          )}
        </div>
      </button>
    </li>
  )
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
}: ReviewInboxQueueProps) {
  const { t } = useTranslation()
  const { projects } = useProjects()

  const projectMap = new Map(projects.map((p) => [p.id, p.name]))

  const scopedProposals = proposals.filter((p) => {
    if (selectedProjectId !== 'all' && p.projectId !== selectedProjectId) {
      return false
    }
    if (duplicateOnly && !p.targetOfficialTestCaseId) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const titleMatch = p.title.toLowerCase().includes(q)
      const objMatch = p.objective.toLowerCase().includes(q)
      const pNameMatch = (projectMap.get(p.projectId) || '').toLowerCase().includes(q)
      return titleMatch || objMatch || pNameMatch
    }
    return true
  })

  const statusCounts: Record<ReviewQueueStatusFilter, number> = {
    all: scopedProposals.length,
    in_review: scopedProposals.filter((p) => p.status === 'in_review').length,
    approved: scopedProposals.filter((p) => p.status === 'approved').length,
    rejected: scopedProposals.filter((p) => p.status === 'rejected').length,
  }

  const filteredProposals = scopedProposals.filter((p) => statusFilter === 'all' || p.status === statusFilter)

  return (
    <Card className="rounded-none border-0 h-full flex flex-col justify-between overflow-hidden bg-surface">
      {/* Search & Filter Header */}
      <div className="p-3.5 sm:p-4 border-b border-border bg-canvas/30 space-y-3 shrink-0">
        {/* Search input */}
        <div className="relative">
          <MagnifyingGlass
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t('reviewInbox.searchPlaceholder')}
            aria-label={t('reviewInbox.searchPlaceholder')}
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-1.5 text-xs text-default placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filters row: Project selector & Duplicate toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[130px]">
            <select
              value={selectedProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
              aria-label={t('reviewInbox.project')}
              className="w-full rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-default focus:border-primary focus:outline-none"
            >
              <option value="all">{t('reviewInbox.allProjects')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            aria-pressed={duplicateOnly}
            onClick={onToggleDuplicateOnly}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.98] ${
              duplicateOnly
                ? 'bg-warn-bg text-warn border border-warn/30'
                : 'border border-border bg-surface text-muted hover:text-default'
            }`}
          >
            <CopySimple size={12} weight="bold" aria-hidden="true" />
            <span>{t('reviewInbox.filterDuplicates')}</span>
          </button>
        </div>

        {/* Status filter tabs, counts inline per status */}
        <div className="flex items-center gap-1 overflow-x-auto pt-0.5">
          {(['in_review', 'all', 'approved', 'rejected'] as const).map((status) => {
            const isCurrent = statusFilter === status
            const label =
              status === 'in_review'
                ? t('reviewInbox.filterInReview')
                : status === 'approved'
                ? t('reviewInbox.filterApproved')
                : status === 'rejected'
                ? t('reviewInbox.filterRejected')
                : t('reviewInbox.filterAll')

            return (
              <button
                key={status}
                type="button"
                aria-pressed={isCurrent}
                onClick={() => onStatusFilterChange(status)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 ${
                  isCurrent
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted hover:text-default hover:bg-surface-hover'
                }`}
              >
                <span>{label}</span>{' '}
                <span className="font-mono tabular-nums text-[10px] text-muted">{statusCounts[status]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Proposals List */}
      <CardContent className="p-0 flex-1 overflow-y-auto">
        {filteredProposals.length === 0 ? (
          <StateView
            kind="empty"
            title={t('reviewInbox.noProposalsFound')}
            description={t('reviewInbox.noProposalsDescription')}
            className="p-8 h-full"
          />
        ) : (
          <EntityList aria-label={t('reviewInbox.queueTitle')}>
            {filteredProposals.map((proposal) => (
              <ReviewProposalQueueRow
                key={proposal.id}
                proposal={proposal}
                isSelected={proposal.id === selectedId}
                onSelect={onSelect}
                projectName={projectMap.get(proposal.projectId)}
              />
            ))}
          </EntityList>
        )}
      </CardContent>

      {/* Keyboard shortcut hints */}
      <div
        aria-label={t('reviewInbox.keyboardShortcuts')}
        className="hidden shrink-0 items-center gap-3 border-t border-border bg-canvas/30 px-3.5 py-1.5 text-[11px] text-muted sm:flex"
      >
        {[
          { key: 'A', label: t('reviewInbox.shortcutApprove') },
          { key: 'R', label: t('reviewInbox.shortcutReject') },
          { key: 'D', label: t('reviewInbox.shortcutDuplicates') },
        ].map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <kbd className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border bg-surface text-default">
              {s.key}
            </kbd>
            <span>{s.label}</span>
          </span>
        ))}
      </div>
    </Card>
  )
}
