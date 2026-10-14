'use client'

import Link from 'next/link'
import { Clock, ListDashes, SealCheck, type Icon } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { statusToneClassNames } from '@/components/ui/status-presentation'
import { reviewInboxProposalPath } from '@/features/projects/lib/routes'
import type { CaseAttention } from '@/features/projects/suites/lib/case-attention'

type Tone = 'warn' | 'muted'

interface AttentionPresentation {
  labelKey: string
  tone: Tone
  Icon: Icon
}

const presentations: Record<
  Exclude<CaseAttention, 'in-review'>,
  AttentionPresentation
> = {
  undocumented: {
    labelKey: 'suites.caseUndocumented',
    tone: 'warn',
    Icon: ListDashes,
  },
  'awaiting-confirmation': {
    labelKey: 'suites.caseAwaitingConfirmation',
    tone: 'warn',
    Icon: SealCheck,
  },
}

interface CaseAttentionChipProps {
  attention: Exclude<CaseAttention, 'in-review'>
}

interface CaseInReviewChipProps {
  proposalId: string
}

/**
 * Where a case waits for a reviewer: a link to the proposal itself, not to the
 * inbox. The accessible name keeps the visible label and adds where it leads.
 */
export function CaseInReviewChip({ proposalId }: CaseInReviewChipProps) {
  const { t } = useTranslation()

  return (
    <Link
      href={reviewInboxProposalPath(proposalId)}
      aria-label={t('suites.caseInReviewLink')}
      data-attention="in-review"
      className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold bg-ai-bg text-ai outline-none transition-colors duration-150 hover:bg-ai-bg/70 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Clock size={12} weight="fill" aria-hidden="true" />
      {t('suites.caseInReview')}
    </Link>
  )
}

export function CaseAttentionChip({ attention }: CaseAttentionChipProps) {
  const { t } = useTranslation()
  const { labelKey, tone, Icon } = presentations[attention]
  const label = t(labelKey)

  return (
    <span
      aria-label={label}
      data-attention={attention}
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold ${statusToneClassNames[tone]}`}
    >
      <Icon size={12} weight="fill" aria-hidden="true" />
      {label}
    </span>
  )
}
