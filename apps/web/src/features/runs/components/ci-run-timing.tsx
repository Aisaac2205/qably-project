'use client'

import { useId } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { approxDuration, freshness } from '../lib/ci-run-format'

export function CiRunDuration({
  startedAt,
  lastReportedAt,
  focusable = false,
}: {
  startedAt: string
  lastReportedAt: string
  focusable?: boolean
}) {
  const { t } = useTranslation()
  const descriptionId = useId()
  const parts = approxDuration(startedAt, lastReportedAt)

  if (parts === undefined) return null

  const value = parts.map((part) => t(part.key, { count: part.count })).join(' ')

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={focusable ? <span tabIndex={0} aria-describedby={descriptionId} /> : <span />}
          className={cn(
            'tabular-nums',
            focusable &&
              'rounded focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          )}
        >
          {t('runs.ci.durationApprox', { value })}
        </TooltipTrigger>
        <TooltipContent>{t('runs.ci.durationTooltip')}</TooltipContent>
      </Tooltip>
      {focusable && (
        <span id={descriptionId} className="sr-only">
          {t('runs.ci.durationTooltip')}
        </span>
      )}
    </>
  )
}

export function CiRunFreshness({ lastReportedAt, now }: { lastReportedAt: string; now: number }) {
  const { t } = useTranslation()
  const part = freshness(lastReportedAt, now)

  return (
    <time dateTime={lastReportedAt} className="tabular-nums">
      {t(part.key, { count: part.count })}
    </time>
  )
}
