'use client'

import { useTranslation } from '@/lib/i18n'
import type { CaseState, ReviewStatus } from '@qably/types'
import {
  getCaseLifecyclePresentation,
  getLegacyStatusPresentation,
  getReviewStatusPresentation,
  statusToneClassNames,
  type LegacyStatus,
  type StatusPresentation,
} from './status-presentation'

export type StatusChipProps =
  | { status: LegacyStatus; scope?: undefined }
  | { status: ReviewStatus; scope: 'review' }
  | { status: CaseState; scope: 'lifecycle' }

function getStatusPresentation(props: StatusChipProps): StatusPresentation {
  if (props.scope === 'review') return getReviewStatusPresentation(props.status)
  if (props.scope === 'lifecycle') return getCaseLifecyclePresentation(props.status)
  return getLegacyStatusPresentation(props.status)
}

export function StatusChip(props: StatusChipProps) {
  const { t } = useTranslation()
  const presentation = getStatusPresentation(props)
  const label = t(presentation.labelKey)
  const Icon = presentation.Icon

  return (
    <span
      aria-label={label}
      data-status={presentation.status}
      data-tone={presentation.tone}
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold ${statusToneClassNames[presentation.tone]}`}
    >
      <Icon
        size={12}
        weight="fill"
        className={presentation.animated ? 'animate-spin motion-reduce:animate-none' : undefined}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
