'use client'

import Link from 'next/link'
import type { RunSource, RunSummaryRecord } from '@qably/types'
import { useRunsPage } from '../hooks/use-runs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusChip } from './status-chip'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { docsUrl } from '@/lib/docs-url'
import { GitCommit } from '@phosphor-icons/react'
import { formatPassRate } from '../lib/format'
import { RunDeltaChip } from './run-delta-chip'

const REPORT_CI_ANCHOR = 'step-4-report-ci'

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
  return (
    <Link
      href={`/projects/${projectId}/runs/${run.id}`}
      className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-surface-hover/60 transition-colors"
    >
      <div className="min-w-0 flex-1 flex items-center gap-3.5">
        <StatusChip status={run.status} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-default truncate">{run.name}</div>
          <div className="text-xs text-muted truncate mt-0.5">{run.suiteName}</div>
          {run.commitSha && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted min-w-0">
              <GitCommit size={12} weight="bold" aria-hidden="true" className="shrink-0" />
              <span className="font-mono text-default">{run.commitSha.slice(0, 7)}</span>
              {run.commitMessage && <span className="truncate">{run.commitMessage}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-4">
        <RunDeltaChip delta={run.delta} />
        <span className="text-sm font-semibold tabular-nums font-mono text-default w-12 text-right">
          {formatPassRate(run.passRate)}
        </span>
        <Badge variant="outline" className="hidden sm:inline-flex font-normal text-xs">
          {run.source.replace('_', ' ')}
        </Badge>
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

export function RunList({ projectId, source }: { projectId: string; source?: RunSource }) {
  const { runs, hasNextPage, isFetchingNextPage, fetchNextPage } = useRunsPage(
    projectId,
    source,
  )
  const { t, locale } = useTranslation()

  if (runs.length === 0) {
    return (
      <StateView
        kind="empty"
        title={t('runs.noRuns')}
        description={t('runs.emptyDescription')}
        action={
          <div className="flex flex-col items-center gap-2">
            <a
              href={docsUrl(REPORT_CI_ANCHOR, locale)}
              className="text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('runs.emptyDocsLink')}
            </a>
            <Link
              href={`/projects/${projectId}/runs/new`}
              className="text-sm font-medium text-default hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('runs.startARun')}
            </Link>
          </div>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <CardContent className="p-0">
          <EntityList aria-label={t('runs.ariaRunCases')} className="divide-y divide-border">
            {runs.map((r) => (
              <li key={r.id}>
                <RunRow run={r} projectId={projectId} />
              </li>
            ))}
          </EntityList>
        </CardContent>
      </Card>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
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
