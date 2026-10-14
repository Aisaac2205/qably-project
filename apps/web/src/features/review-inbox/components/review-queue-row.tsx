'use client'

import {
  ArrowsClockwise,
  CopySimple,
  CheckCircle,
  XCircle,
  Clock,
  CaretRight,
  ChatCircleText,
  FileText,
  GitCommit,
  Sparkle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import type { ProposalOrigin } from '@qably/types'
import type { ProposalClassification, ProposalListItem } from '../api/review.api'
import { matchedCaseHref, resolveClassification } from '../lib/classification-reason'
import { extractionFailureReasonKey } from '@/lib/extraction-failure-reason'
import { Badge, badgeVariants } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

const ORIGIN_LABEL_KEYS: Record<Exclude<ProposalOrigin['kind'], 'push'>, string> = {
  documentation: 'reviewInbox.originDocumentation',
  'case-documentation': 'reviewInbox.originCaseDocumentation',
  chat: 'reviewInbox.originChat',
}

/** Says why the proposal is in the inbox: the push it came from, or the request that produced it. */
function ProposalOriginLabel({ origin }: { origin: ProposalOrigin }) {
  const { t } = useTranslation()

  if (origin.kind !== 'push') {
    const OriginIcon = origin.kind === 'chat' ? ChatCircleText : Sparkle
    return (
      <span data-testid="proposal-origin" className="inline-flex items-center gap-1 text-[11px] text-muted">
        <OriginIcon size={12} className="shrink-0 text-muted" aria-hidden="true" />
        <span>{t(ORIGIN_LABEL_KEYS[origin.kind])}</span>
      </span>
    )
  }

  return (
    <span
      data-testid="proposal-origin"
      className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted"
    >
      <GitCommit size={12} className="shrink-0 text-muted" aria-hidden="true" />
      <span>
        {origin.pullRequestNumber === null
          ? t('reviewInbox.originPush')
          : t('reviewInbox.originPullRequest', { number: origin.pullRequestNumber })}
      </span>
      {origin.commitSha !== null && (
        <>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{origin.commitSha.slice(0, 7)}</span>
        </>
      )}
      {origin.author !== null && (
        <>
          <span aria-hidden="true">·</span>
          <span className="truncate">{origin.author}</span>
        </>
      )}
    </span>
  )
}

export interface ReviewQueueRowProps {
  proposal: ProposalListItem
  isSelected: boolean
  onSelect: (id: string) => void
}

/**
 * Says what the proposal does to an existing case. It links to that case, so it
 * sits beside the row's select button rather than inside it: a link cannot live
 * in a button, and opening the case must not select the row.
 */
function ClassificationBadge({
  projectId,
  classification,
}: {
  projectId: string
  classification: ProposalClassification
}) {
  const { t } = useTranslation()

  const isUpdate = classification.kind === 'update'
  const Icon = isUpdate ? ArrowsClockwise : CopySimple
  const label =
    classification.matchedCaseName === null
      ? t(isUpdate ? 'reviewInbox.classificationUpdate' : 'reviewInbox.classificationPossibleDuplicate')
      : t(
          isUpdate
            ? 'reviewInbox.classificationUpdateNamed'
            : 'reviewInbox.classificationPossibleDuplicateNamed',
          { name: classification.matchedCaseName },
        )
  const href = matchedCaseHref(projectId, classification)
  const badgeClassName = cn(
    badgeVariants({ variant: isUpdate ? 'default' : 'warn' }),
    'max-w-full min-h-6 text-[10px] px-1.5 py-0.5 font-medium rounded-full',
  )

  const content = (
    <>
      <Icon size={10} weight="bold" className="shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </>
  )

  return (
    <div className="px-3.5 pb-3 sm:px-4 sm:pb-3.5">
      {href === null ? (
        <span className={badgeClassName}>{content}</span>
      ) : (
        <Link
          href={href}
          className={cn(
            badgeClassName,
            'outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          {content}
        </Link>
      )}
    </div>
  )
}

export function ReviewQueueRow({ proposal, isSelected, onSelect }: ReviewQueueRowProps) {
  const { t } = useTranslation()

  const isPending = proposal.status === 'in_review'
  const isApproved = proposal.status === 'approved'
  const isRejected = proposal.status === 'rejected'

  const needsManualReview = proposal.needsManualReview || proposal.steps.length === 0
  const classification = resolveClassification(proposal.classification)
  const hasClassification = classification.kind !== 'none'
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
    : null

  return (
    <li
      className={cn(
        'group border-b border-l-4 border-border/70 transition-colors duration-150 hover:bg-surface-hover/70',
        isSelected ? 'bg-surface-hover/90 border-l-primary' : 'border-l-transparent',
      )}
    >
      <button
        type="button"
        id={`review-queue-row-${proposal.id}`}
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(proposal.id)}
        className={cn(
          'block w-full min-w-0 text-left p-3.5 sm:p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary',
          hasClassification && 'pb-2 sm:pb-2',
        )}
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

          {proposal.origin && <ProposalOriginLabel origin={proposal.origin} />}

          {formattedDate && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Clock size={12} className="shrink-0 text-muted" aria-hidden="true" />
              <span>{formattedDate}</span>
            </span>
          )}
        </div>
      </button>

      {hasClassification && (
        <ClassificationBadge projectId={proposal.projectId} classification={classification} />
      )}
    </li>
  )
}
