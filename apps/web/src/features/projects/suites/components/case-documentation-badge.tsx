'use client'

import { CircleNotch, ListDashes, MinusCircle, XCircle } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { statusToneClassNames } from '@/components/ui/status-presentation'
import type { CaseDocumentationBadge as CaseDocumentationBadgeState } from '@/features/projects/suites/lib/case-documentation-state'

const FIELD_LABEL_KEYS: Record<string, string> = {
  title: 'suites.caseNameLabel',
  objective: 'suites.objectiveLabel',
  steps: 'suites.stepsLabel',
  expectedResult: 'suites.expectedResultLabel',
}

const SKIP_REASON_KEYS: Record<string, string> = {
  'no-source-file': 'suites.caseSkippedReasonNoSourceFile',
  'no-automation-key': 'suites.caseSkippedReasonNoAutomationKey',
  'already-pending': 'suites.caseSkippedReasonAlreadyPending',
  'human-documented': 'suites.caseSkippedReasonHumanDocumented',
  unknown: 'suites.caseSkippedReasonUnknown',
}

const CHIP_CLASS = 'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold'

interface CaseDocumentationBadgeProps {
  badge: CaseDocumentationBadgeState
}

export function CaseDocumentationBadge({ badge }: CaseDocumentationBadgeProps) {
  const { t } = useTranslation()

  if (badge.kind === 'documenting') {
    const label = t('suites.caseDocumenting')
    return (
      <span aria-label={label} data-documentation-state="documenting" className={`${CHIP_CLASS} bg-ai-bg text-ai`}>
        <CircleNotch
          size={12}
          weight="bold"
          className="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {label}
      </span>
    )
  }

  if (badge.kind === 'incomplete') {
    const fields = badge.missing.map((field) => t(FIELD_LABEL_KEYS[field] ?? field)).join(', ')
    const label = t('suites.caseIncomplete', { fields })
    return (
      <span
        aria-label={label}
        data-documentation-state="incomplete"
        className={`${CHIP_CLASS} ${statusToneClassNames.warn}`}
      >
        <ListDashes size={12} weight="fill" aria-hidden="true" />
        {label}
      </span>
    )
  }

  if (badge.kind === 'skipped') {
    const reasonKey = badge.reason === null ? undefined : SKIP_REASON_KEYS[badge.reason]
    const reason = reasonKey ? t(reasonKey) : ''
    const label = t('suites.caseSkipped', { reason })
    return (
      <span
        aria-label={label}
        data-documentation-state="skipped"
        className={`${CHIP_CLASS} ${statusToneClassNames.muted}`}
      >
        <MinusCircle size={12} weight="fill" aria-hidden="true" />
        {label}
      </span>
    )
  }

  const label = t('suites.caseFailed')
  return (
    <span aria-label={label} data-documentation-state="failed" className={`${CHIP_CLASS} ${statusToneClassNames.fail}`}>
      <XCircle size={12} weight="fill" aria-hidden="true" />
      {label}
    </span>
  )
}
