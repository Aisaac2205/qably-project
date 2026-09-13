'use client'

import { CircleDashed, ListDashes, SealCheck, type Icon } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { statusToneClassNames } from '@/components/ui/status-presentation'
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
  'never-run': {
    labelKey: 'quality.signals.neverRunLabel',
    tone: 'muted',
    Icon: CircleDashed,
  },
}

interface CaseAttentionChipProps {
  attention: Exclude<CaseAttention, 'in-review'>
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
