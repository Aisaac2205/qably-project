'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { approxDuration, freshness } from '../lib/ci-run-format'

export function CiRunDuration({
  startedAt,
  lastReportedAt,
}: {
  startedAt: string
  lastReportedAt: string
}) {
  const { t } = useTranslation()
  const parts = approxDuration(startedAt, lastReportedAt)

  if (parts === undefined) return null

  const value = parts.map((part) => t(part.key, { count: part.count })).join(' ')

  return (
    <Tooltip>
      <TooltipTrigger render={<span />} className="tabular-nums">
        {t('runs.ci.durationApprox', { value })}
      </TooltipTrigger>
      <TooltipContent>{t('runs.ci.durationTooltip')}</TooltipContent>
    </Tooltip>
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
