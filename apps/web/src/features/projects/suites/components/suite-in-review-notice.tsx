'use client'

import Link from 'next/link'
import { ArrowRight, Clock } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

interface SuiteInReviewNoticeProps {
  projectId: string
  pendingProposals: number | undefined
}

/**
 * Says how many proposals of the suite wait in the review inbox. Proposals that
 * would create a new case have no row in the case list yet, so this is the only
 * place the suite shows them.
 */
export function SuiteInReviewNotice({ projectId, pendingProposals }: SuiteInReviewNoticeProps) {
  const { t } = useTranslation()

  if (pendingProposals === undefined || pendingProposals === 0) return null

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-dashed border-ai/40 bg-ai-bg/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-default">
          <Clock size={14} weight="bold" className="shrink-0 text-ai" aria-hidden="true" />
          {t('suites.pendingProposals', { count: pendingProposals })}
        </p>
        <p className="text-xs text-muted leading-relaxed">{t('suites.pendingProposalsHint')}</p>
      </div>
      <Link
        href={`/review-inbox?projectId=${encodeURIComponent(projectId)}`}
        className="inline-flex shrink-0 items-center gap-1 self-start rounded-md py-1 text-sm font-semibold text-default transition-colors hover:underline outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto"
      >
        {t('suites.openReviewInbox')}
        <ArrowRight size={14} weight="bold" aria-hidden="true" />
      </Link>
    </div>
  )
}
