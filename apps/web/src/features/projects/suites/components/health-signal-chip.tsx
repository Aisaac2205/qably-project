'use client'

import type { CaseHealthSignal } from '@qably/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { getCaseHealthSignalPresentation } from '../lib/case-health-presentation'

interface HealthSignalChipProps {
  signal: CaseHealthSignal
  count?: number
}

export function HealthSignalChip({ signal, count }: HealthSignalChipProps) {
  const { t } = useTranslation()
  const presentation = getCaseHealthSignalPresentation(signal)
  const label = t(presentation.labelKey)
  const description = t(presentation.descriptionKey)
  const Icon = presentation.Icon

  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-warn/25 bg-warn-bg px-2 py-1 text-xs font-semibold text-warn outline-none focus-visible:ring-1 focus-visible:ring-primary/40">
        <Icon size={12} weight="bold" aria-hidden="true" />
        <span>{label}</span>
        {count !== undefined && <span className="font-mono tabular-nums">{count}</span>}
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  )
}
