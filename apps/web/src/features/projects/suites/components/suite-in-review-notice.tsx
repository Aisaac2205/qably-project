'use client'

import Link from 'next/link'
import { ArrowRight, Clock } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

interface SuiteInReviewNoticeProps {
  projectId: string
  newCaseProposals: number | undefined
}

/**
 * Says how many proposals of the suite would create a new case. Every other
 * waiting proposal already shows as "In review" on the case it is about; these
 * have no case row yet, so this is the only place the suite shows them.
 */
export function SuiteInReviewNotice({ projectId, newCaseProposals }: SuiteInReviewNoticeProps) {
  const { t } = useTranslation()

  if (newCaseProposals === undefined || newCaseProposals === 0) return null

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-dashed border-ai/40 bg-ai-bg/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-default">
        <Clock size={14} weight="bold" className="shrink-0 text-ai" aria-hidden="true" />
        {t('suites.newCaseProposals', { count: newCaseProposals })}
      </p>
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
