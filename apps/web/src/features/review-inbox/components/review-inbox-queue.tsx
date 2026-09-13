'use client'

import {
  MagnifyingGlass,
  Sparkle,
  CopySimple,
  CheckCircle,
  XCircle,
  Clock,
  CaretRight,
  ChatCircleText,
  FileText,
} from '@phosphor-icons/react'
import type { ProposalListItem } from '../api/review.api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EntityList } from '@/components/ui/entity-list'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { StateView } from '@/components/ui/state-view'
import { useProjects } from '@/features/projects/hooks/use-projects'
import { useTranslation } from '@/lib/i18n'

export type ReviewQueueStatusFilter = 'in_review' | 'all' | 'approved' | 'rejected'

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
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleSelectAll?: (ids: string[]) => void
  onBulkApprove?: (ids: string[]) => void
  onBulkReject?: (ids: string[]) => void
  isBulkApproving?: boolean
  isBulkRejecting?: boolean
}

function ReviewProposalQueueRow({
  proposal,
  isSelected,
  onSelect,
  projectName,
}: {
  proposal: ProposalListItem
  isSelected: boolean
  onSelect: (id: string) => void
  projectName?: string
}) {
  const { t } = useTranslation()

  const isPending = proposal.status === 'in_review'
  const isApproved = proposal.status === 'approved'
  const isRejected = proposal.status === 'rejected'

  const formattedDate = proposal.createdAt
    ? new Date(proposal.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Sep 9, 01:23 PM'

  return (
    <li className="flex items-stretch">
      <button
        type="button"
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(proposal.id)}
        className={`group flex-1 min-w-0 text-left p-3.5 sm:p-4 transition-all duration-150 hover:bg-surface-hover/70 outline-none focus-visible:ring-2 focus-visible:ring-primary border-b border-border/70 ${
          isSelected
            ? 'bg-surface-hover/90 border-l-4 border-l-primary shadow-xs'
            : 'border-l-4 border-l-transparent'
        }`}
      >
        {/* Badges row */}
        <div className="flex items-center gap-2 mb-2">
          {proposal.priority === 'critical' ? (
            <span className="size-2 rounded-full bg-fail shrink-0" aria-hidden="true" />
          ) : proposal.priority === 'high' ? (
            <span className="size-2 rounded-full bg-warn shrink-0" aria-hidden="true" />
          ) : null}

          <Badge
            variant={proposal.priority === 'critical' || proposal.priority === 'high' ? 'warn' : 'default'}
            className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
          >
            {proposal.priority}
          </Badge>

          {projectName && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-canvas/40 px-2 py-0.5 text-[10px] font-medium text-muted">
              <span>{projectName}</span>
            </span>
          )}

          {isApproved && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-pass-bg text-pass">
              <CheckCircle size={11} weight="fill" aria-hidden="true" />
              {t('reviewInbox.decisionApproved')}
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-fail-bg text-fail">
              <XCircle size={11} weight="fill" aria-hidden="true" />
              {t('reviewInbox.decisionRejected')}
            </span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium text-muted bg-canvas">
              <Clock size={11} aria-hidden="true" />
              {t('status.review.pending')}
            </span>
          )}

          {proposal.possibleDuplicate && (
            <Badge variant="warn" className="text-[10px] px-1.5 py-0.5 font-medium rounded-full ml-auto">
              <CopySimple size={10} weight="bold" aria-hidden="true" />
              {t('reviewInbox.possibleDuplicate')}
            </Badge>
          )}
        </div>

        {/* Title and Chevron */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs sm:text-sm font-semibold text-default truncate flex-1 leading-snug">
            {proposal.title}
          </p>
          <CaretRight
            size={14}
            className={`shrink-0 transition-colors mt-0.5 ${
              isSelected ? 'text-default' : 'text-muted/40 group-hover:text-muted'
            }`}
            aria-hidden="true"
          />
        </div>

        {/* Subtitle / Objective context preview */}
        {proposal.objective && proposal.objective !== proposal.title && (
          <p className="text-xs text-muted truncate mb-2.5 line-clamp-1">
            {proposal.objective}
          </p>
        )}

        {/* Metadata Footer Row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {proposal.evidenceTitle && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted truncate max-w-44">
              <FileText size={12} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="truncate">{proposal.evidenceTitle}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <Clock size={12} className="shrink-0 text-muted" aria-hidden="true" />
            <span>{formattedDate}</span>
          </span>

          <span className="inline-flex items-center gap-1 text-[11px] text-muted ml-auto sm:ml-0">
            <ChatCircleText size={12} className="shrink-0 text-muted" aria-hidden="true" />
            <span>0</span>
          </span>
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
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onBulkApprove,
  onBulkReject,
  isBulkApproving,
  isBulkRejecting,
}: ReviewInboxQueueProps) {
  const { t } = useTranslation()
  const { projects } = useProjects()

  const projectMap = new Map(projects.map((p) => [p.id, p.name]))

  const scopedProposals = proposals.filter((p) => {
    if (selectedProjectId !== 'all' && p.projectId !== selectedProjectId) {
      return false
    }
    if (duplicateOnly && p.possibleDuplicate !== true) {
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
      <div className="p-3.5 sm:p-4 border-b border-border bg-canvas/30 space-y-3 shrink-0">
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

        <div className="flex items-center overflow-x-auto pt-0.5">
          <SegmentedControl
            size="sm"
            label={t('reviewInbox.filterStatus')}
            options={(['in_review', 'all', 'approved', 'rejected'] as const).map(
              (status) => ({
                value: status,
                label: (
                  <>
                    <span>
                      {status === 'in_review'
                        ? t('reviewInbox.filterInReview')
                        : status === 'approved'
                        ? t('reviewInbox.filterApproved')
                        : status === 'rejected'
                        ? t('reviewInbox.filterRejected')
                        : t('reviewInbox.filterAll')}
                    </span>
                    <span className="font-mono tabular-nums text-[10px] font-normal opacity-70">
                      {statusCounts[status]}
                    </span>
                  </>
                ),
              }),
            )}
            value={statusFilter}
            onChange={onStatusFilterChange}
          />
        </div>
      </div>

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
