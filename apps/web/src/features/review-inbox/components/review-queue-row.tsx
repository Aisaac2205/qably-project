'use client'

import { CopySimple, CheckCircle, XCircle, Clock, CaretRight, ChatCircleText, FileText } from '@phosphor-icons/react'
import type { ProposalListItem } from '../api/review.api'
import { extractionFailureReasonKey } from '@/lib/extraction-failure-reason'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n'

export interface ReviewQueueRowProps {
  proposal: ProposalListItem
  isSelected: boolean
  onSelect: (id: string) => void
  projectName?: string
}

export function ReviewQueueRow({ proposal, isSelected, onSelect, projectName }: ReviewQueueRowProps) {
  const { t } = useTranslation()

  const isPending = proposal.status === 'in_review'
  const isApproved = proposal.status === 'approved'
  const isRejected = proposal.status === 'rejected'

  const needsManualReview = proposal.needsManualReview || proposal.steps.length === 0
  const manualReviewReason = needsManualReview ? extractionFailureReasonKey(proposal.objective) : null
  const subtitle = !needsManualReview
    ? proposal.objective
    : t(`reviewInbox.${manualReviewReason ?? 'manualReviewReasonUnknown'}`)

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

        {subtitle && subtitle !== proposal.title && (
          <p className="text-xs text-muted truncate mb-2.5 line-clamp-1">{subtitle}</p>
        )}

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
