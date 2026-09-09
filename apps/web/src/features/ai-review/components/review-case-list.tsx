'use client'

import type { ProposalListItem } from '@/features/review-inbox/api/review.api'
import { CaretRight, ChatCircleText, Clock, CopySimple, FileText, Plus } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'

function getPriorityBadgeVariant(priority: ProposalListItem['priority']): 'warn' | 'default' {
  if (priority === 'critical' || priority === 'high') {
    return 'warn'
  }
  return 'default'
}

function ReviewCaseListRow({
  proposal,
  isSelected,
  onSelect,
}: {
  proposal: ProposalListItem
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()

  const formattedDate = proposal.createdAt
    ? new Date(proposal.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Sep 9, 01:23 PM'

  return (
    <li>
      <button
        type="button"
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(proposal.id)}
        className={`group w-full text-left p-3.5 sm:p-4 transition-all duration-150 border-b border-border/70 hover:bg-surface-hover/70 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
            variant={getPriorityBadgeVariant(proposal.priority)}
            className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
          >
            {proposal.priority}
          </Badge>

          <span className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-canvas/40 px-2 py-0.5 text-[10px] font-medium text-muted">
            <Plus size={9} aria-hidden="true" />
            <span>Qably Project</span>
          </span>

          {proposal.targetOfficialTestCaseId && (
            <Badge variant="warn" className="text-[10px] px-1.5 py-0.5 font-medium rounded-full ml-auto">
              <CopySimple size={10} weight="bold" aria-hidden="true" />
              {t('aiReview.possibleDuplicate')}
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

export function ReviewCaseList({
  proposals,
  selectedId,
  onSelect,
  filter = 'all',
}: {
  proposals: ProposalListItem[]
  selectedId?: string
  onSelect: (id: string) => void
  filter?: 'all' | 'duplicates'
}) {
  const { t } = useTranslation()
  const visibleProposals =
    filter === 'duplicates'
      ? proposals.filter((p) => p.targetOfficialTestCaseId)
      : proposals

  if (visibleProposals.length === 0) {
    return (
      <StateView
        kind="empty"
        title={filter === 'duplicates' ? t('aiReview.noDuplicates') : t('aiReview.noCasesPending')}
        className="h-full"
      />
    )
  }

  return (
    <div className="h-full flex flex-col">
      <EntityList aria-label={t('aiReview.ariaReviewCases')}>
        {visibleProposals.map((proposal) => (
          <ReviewCaseListRow
            key={proposal.id}
            proposal={proposal}
            isSelected={proposal.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </EntityList>
    </div>
  )
}

