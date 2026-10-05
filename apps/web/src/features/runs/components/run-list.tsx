'use client'

import Link from 'next/link'
import type { RunSummaryRecord } from '@qably/types'
import { useRunsPage } from '../hooks/use-runs'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { StatusChip } from './status-chip'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { QablyMarkIcon } from '@/components/icons/qably-mark-icon'
import { formatPassRate, runTitleParts } from '../lib/format'
import { RunDeltaChip } from './run-delta-chip'

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function RunRow({
  run,
  projectId,
}: {
  run: RunSummaryRecord
  projectId: string
}) {
  const { t } = useTranslation()
  const { title, subtitle } = runTitleParts(run, run.suiteName)

  return (
    <Link
      href={`/projects/${projectId}/runs/${run.id}`}
      className="flex items-center justify-between px-5 py-3 sm:px-7 lg:px-9 sm:py-3.5 hover:bg-runs-hover/60 transition-colors focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary forced-colors:focus-visible:-outline-offset-2!"
    >
      <div className="min-w-0 flex-1 flex items-center gap-3.5">
        <StatusChip status={run.status} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-default truncate">{title}</div>
          {subtitle && <div className="text-xs text-muted truncate mt-0.5">{subtitle}</div>}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2.5 sm:gap-4">
        <RunDeltaChip delta={run.delta} />
        <span className="text-sm font-semibold tabular-nums font-mono text-default w-12 text-right">
          {formatPassRate(run.passRate)}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={<span tabIndex={0} aria-label={t('runs.sourceManual')} />}
            className="hidden sm:inline-flex shrink-0 size-7 items-center justify-center rounded text-primary focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <QablyMarkIcon className="size-5" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>{t('runs.sourceManual')}</TooltipContent>
        </Tooltip>
        <div className="text-right hidden sm:block">
          <div className="text-xs font-medium text-default">{formatDate(run.startedAt)}</div>
          {run.finishedAt && (
            <div className="text-xs text-muted mt-0.5">{formatDate(run.finishedAt)}</div>
          )}
        </div>
      </div>
    </Link>
  )
}

function EmptyRunList({
  projectId,
  hasManualCases,
}: {
  projectId: string
  hasManualCases: boolean | undefined
}) {
  const { t } = useTranslation()

  return (
    <StateView
      kind="empty"
      title={t('runs.ci.manualEmptyTitle')}
      description={t('runs.ci.manualEmptyDescription')}
      action={
        hasManualCases !== false ? (
          <Link
            href={`/projects/${projectId}/runs/new`}
            className="rounded text-sm font-medium text-default hover:text-primary transition-colors focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t('runs.startARun')}
          </Link>
        ) : undefined
      }
    />
  )
}

export function RunList({
  projectId,
  hasManualCases,
}: {
  projectId: string
  hasManualCases?: boolean
}) {
  const { runs, hasNextPage, isFetchingNextPage, fetchNextPage } = useRunsPage(
    projectId,
    'manual',
  )
  const { t } = useTranslation()

  if (runs.length === 0) {
    return <EmptyRunList projectId={projectId} hasManualCases={hasManualCases} />
  }

  return (
    <div className="space-y-4">
      <div className="rule-bleed !px-0 border-y border-border">
        <EntityList aria-label={t('runs.ariaRunCases')} className="divide-y divide-border">
          {runs.map((run) => (
            <li key={run.id}>
              <RunRow run={run} projectId={projectId} />
            </li>
          ))}
        </EntityList>
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto px-4 text-sm hover:bg-runs-hover focus-visible:outline-hidden! focus-visible:ring-primary"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? t('runs.loadingMore') : t('runs.loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
