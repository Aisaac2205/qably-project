'use client'

import Link from 'next/link'
import type { ExtractedProposal } from '@qably/types'
import { CheckCircle, XCircle, ShieldCheck, ArrowUpRight } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { reviewInboxPath } from '@/features/projects/lib/routes'

interface DecisionToolbarProject {
  id: string
}

interface DecisionToolbarProps {
  proposal: ExtractedProposal
  project: DecisionToolbarProject | undefined
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isSubmitting: boolean
}

export function DecisionToolbar({
  proposal,
  project,
  onApprove,
  onReject,
  isSubmitting,
}: DecisionToolbarProps) {
  const { t } = useTranslation()
  const isPending = proposal.status === 'in_review'
  const isApproved = proposal.status === 'approved'
  const hasNothingToPublish = proposal.steps.length === 0

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-surface px-6 py-4">
      {isPending ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isSubmitting || hasNothingToPublish}
            onClick={() => onApprove(proposal.id)}
            aria-label={t('reviewInbox.actionApprove')}
            title={hasNothingToPublish ? t('reviewInbox.approveBlocked') : undefined}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs sm:text-sm font-semibold text-primary-fg shadow-2xs transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary"
          >
            <CheckCircle size={16} weight="fill" aria-hidden="true" />
            {t('reviewInbox.actionApprove')}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onReject(proposal.id)}
            aria-label={t('reviewInbox.actionReject')}
            className="inline-flex items-center gap-2 rounded-full bg-surface border border-fail/40 px-5 py-2.5 text-xs sm:text-sm font-semibold text-fail transition-all duration-150 hover:bg-fail-bg/50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-fail"
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
