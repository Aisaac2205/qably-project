'use client'

import { useId } from 'react'
import Image from 'next/image'
import { ArrowUpRight } from '@phosphor-icons/react'
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
      className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border border-border/80 bg-surface px-2.5 py-1 text-xs font-medium text-default transition-colors hover:border-border hover:bg-surface-hover hover:text-default focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-8"
    >
      <Image
        src="/logos/github.svg"
        alt=""
        width={14}
        height={14}
        aria-hidden="true"
        className="shrink-0"
      />
      <span className="min-w-0 wrap-anywhere">{repository}</span>
      <ArrowUpRight size={12} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
    </a>
  )
}

function CiRunStatus({ status }: { status: CiRunSummaryRecord['status'] }) {
  const { t } = useTranslation()
  const descriptionId = useId()

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={<span tabIndex={0} aria-describedby={descriptionId} />}
          className="inline-flex min-h-6 shrink-0 items-center self-start rounded focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <StatusChip status={status} scope="ci-run" />
        </TooltipTrigger>
        <TooltipContent>{t('runs.ci.statusTooltip')}</TooltipContent>
      </Tooltip>
      <span id={descriptionId} className="sr-only">
        {t('runs.ci.statusTooltip')}
      </span>
    </>
  )
}

export function CiRunHeader({ ciRun }: { ciRun: CiRunSummaryRecord }) {
  const now = useNow(FRESHNESS_TICK_MS)
  const title = ciRunTitle(ciRun)
  const workflow = present(ciRun.workflowName)

  return (
    <header className="space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-lg font-semibold leading-snug tracking-tight text-default wrap-anywhere">
            {title}
          </h2>
          <CiRunMeta ciRun={ciRun} />
        </div>
        <CiRunStatus status={ciRun.status} />
      </div>
      <div className="flex flex-col gap-2 pt-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          {workflow !== undefined && workflow !== title && (
            <span className="wrap-anywhere font-medium text-default">{workflow}</span>
          )}
          <CiRunDuration
            startedAt={ciRun.startedAt}
            lastReportedAt={ciRun.lastReportedAt}
            focusable
          />
          <CiRunFreshness lastReportedAt={ciRun.lastReportedAt} now={now} />
        </div>
        <div className="shrink-0">
          <GitHubRunLink ciRun={ciRun} />
        </div>
      </div>
    </header>
  )
}
