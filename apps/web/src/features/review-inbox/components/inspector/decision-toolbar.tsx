'use client'

import Link from 'next/link'
import type { ExtractedProposal } from '@qably/types'
import {
  CheckCircle,
  XCircle,
  ShieldCheck,
  ArrowUpRight,
  ArrowsClockwise,
  Plus,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { reviewInboxPath } from '@/features/projects/lib/routes'
import type { ApplyTarget, ProposalClassification } from '../../api/review.api'
import { needsApplyChoice } from '../../lib/classification-reason'

/** The first choice of a possible duplicate, so the `A` shortcut can land on it. */
export const APPROVE_UPDATE_BUTTON_ID = 'review-approve-update'

interface DecisionToolbarProject {
  id: string
}

interface DecisionToolbarProps {
  proposal: ExtractedProposal
  project: DecisionToolbarProject | undefined
  classification: ProposalClassification
  onApprove: (id: string, applyTo?: ApplyTarget) => void
  onReject: (id: string) => void
  isSubmitting: boolean
}

const APPROVE_BUTTON =
  'inline-flex min-h-11 items-center gap-2 rounded-md px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary'
const APPROVE_PRIMARY = `${APPROVE_BUTTON} bg-primary text-primary-fg hover:bg-primary-hover`
const APPROVE_SECONDARY = `${APPROVE_BUTTON} bg-surface border border-border-strong text-default hover:bg-surface-hover`

export function DecisionToolbar({
  proposal,
  project,
  classification,
  onApprove,
  onReject,
  isSubmitting,
}: DecisionToolbarProps) {
  const { t } = useTranslation()
  const isPending = proposal.status === 'in_review'
  const isApproved = proposal.status === 'approved'
  const hasNothingToPublish = proposal.steps.length === 0
  const choosesTarget = needsApplyChoice(classification)
  const approveDisabled = isSubmitting || hasNothingToPublish
  const blockedTitle = hasNothingToPublish ? t('reviewInbox.approveBlocked') : undefined

  const updateLabel =
    classification.matchedCaseName === null
      ? t('reviewInbox.actionApproveUpdate')
      : t('reviewInbox.actionApproveUpdateNamed', { name: classification.matchedCaseName })

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-surface px-6 py-4">
      {isPending ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {choosesTarget ? (
            <div
              role="group"
              aria-label={t('reviewInbox.approveChoiceLabel')}
              className="flex flex-wrap items-center gap-2.5"
            >
              <button
                id={APPROVE_UPDATE_BUTTON_ID}
                type="button"
                disabled={approveDisabled}
                onClick={() => onApprove(proposal.id, 'matched-case')}
                aria-label={updateLabel}
                title={blockedTitle ?? updateLabel}
                className={`${APPROVE_PRIMARY} max-w-72`}
              >
                <ArrowsClockwise size={16} weight="bold" className="shrink-0" aria-hidden="true" />
                <span className="truncate">{updateLabel}</span>
              </button>

              <button
                type="button"
                disabled={approveDisabled}
                onClick={() => onApprove(proposal.id, 'new-case')}
                aria-label={t('reviewInbox.actionApproveNew')}
                title={blockedTitle}
                className={APPROVE_SECONDARY}
              >
                <Plus size={16} weight="bold" aria-hidden="true" />
                {t('reviewInbox.actionApproveNew')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={approveDisabled}
              onClick={() => onApprove(proposal.id)}
              aria-label={t('reviewInbox.actionApprove')}
              title={blockedTitle}
              className={APPROVE_PRIMARY}
            >
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
              {t('reviewInbox.actionApprove')}
            </button>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onReject(proposal.id)}
            aria-label={t('reviewInbox.actionReject')}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-surface border border-fail/40 px-5 py-2.5 text-xs sm:text-sm font-semibold text-fail transition-colors duration-150 hover:bg-fail-bg/50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-fail"
          >
            <XCircle size={16} weight="fill" aria-hidden="true" />
            {t('reviewInbox.actionReject')}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted">
          <ShieldCheck
            size={16}
            weight="fill"
            className={isApproved ? 'text-pass' : 'text-fail'}
            aria-hidden="true"
          />
          <span>
            {isApproved ? t('reviewInbox.approvedSuccess') : t('reviewInbox.rejectedSuccess')}
          </span>
        </div>
      )}

      {project && (
        <Link
          href={reviewInboxPath(project.id)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-default group"
        >
          <span>{t('reviewInbox.actionProjectReview')}</span>
          <ArrowUpRight
            size={13}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>
      )}
    </div>
  )
}
