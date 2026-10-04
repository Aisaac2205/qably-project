'use client'

import { ArrowUpRight, GithubLogo } from '@phosphor-icons/react'
import type { CiRunSummaryRecord } from '@qably/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { FRESHNESS_TICK_MS, useNow } from '../hooks/use-now'
import { ciRunTitle, present } from '../lib/ci-run-format'
import { buildCiRunUrl } from '../lib/ci-run-url'
import { CiRunMeta } from './ci-run-meta'
import { CiRunDuration, CiRunFreshness } from './ci-run-timing'
import { StatusChip } from './status-chip'

function GitHubRunLink({ ciRun }: { ciRun: CiRunSummaryRecord }) {
  const { t } = useTranslation()
  const href = buildCiRunUrl(ciRun)
  const repository = present(ciRun.repository)

  if (href === undefined || repository === undefined) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('runs.ci.githubLinkAria', { repository, host: new URL(href).host })}
      className="inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-medium text-default hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-8"
    >
      <GithubLogo size={16} weight="fill" aria-hidden="true" />
      {repository}
      <ArrowUpRight size={12} weight="bold" aria-hidden="true" />
    </a>
  )
}

export function CiRunHeader({ ciRun }: { ciRun: CiRunSummaryRecord }) {
  const { t } = useTranslation()
  const now = useNow(FRESHNESS_TICK_MS)
  const title = ciRunTitle(ciRun)
  const workflow = present(ciRun.workflowName)

  return (
    <header className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold leading-snug tracking-tight text-default wrap-anywhere">
            {title}
          </h2>
          <CiRunMeta ciRun={ciRun} />
        </div>
        <Tooltip>
          <TooltipTrigger
            render={<span tabIndex={0} />}
            className="inline-flex min-h-6 shrink-0 items-center self-start rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <StatusChip status={ciRun.status} scope="ci-run" />
          </TooltipTrigger>
          <TooltipContent>{t('runs.ci.statusTooltip')}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {workflow !== undefined && workflow !== title && <span>{workflow}</span>}
          <CiRunDuration
            startedAt={ciRun.startedAt}
            lastReportedAt={ciRun.lastReportedAt}
            focusable
          />
          <CiRunFreshness lastReportedAt={ciRun.lastReportedAt} now={now} />
        </div>
        <GitHubRunLink ciRun={ciRun} />
      </div>
    </header>
  )
}
