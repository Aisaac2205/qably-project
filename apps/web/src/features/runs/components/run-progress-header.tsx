'use client'

import type { RunRecord } from '@qably/types'
import { GitCommit } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GithubActionsIcon } from '@/components/icons/github-actions-icon'
import { QablyMarkIcon } from '@/components/icons/qably-mark-icon'
import { StatusChip } from './status-chip'
import { useTranslation } from '@/lib/i18n'
import { useSuite } from '@/features/projects/suites/hooks/use-suites'
import { formatPassRate, isCiRun, runTitleParts } from '../lib/format'

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

const SOURCE_LABELS: Record<string, string> = {
  manual: 'runs.sourceManual',
  api: 'runs.sourceApi',
  github_actions: 'runs.sourceCi',
}

const SOURCE_TOOLTIP_KEYS: Record<string, string> = {
  manual: 'runs.sourceTooltipManual',
  api: 'runs.sourceTooltipApi',
  github_actions: 'runs.sourceTooltipCi',
}

function computePassRate(run: RunRecord): number {
  return run.cases.length === 0
    ? 0
    : run.cases.filter((c) => c.status === 'pass').length / run.cases.length
}

export function RunProgressHeader({ run }: { run: RunRecord }) {
  const { t } = useTranslation()
  const { suite } = useSuite(run.suiteId)
  const passRateDisplay = formatPassRate(computePassRate(run))
  const sourceLabelKey = SOURCE_LABELS[run.source]
  const sourceLabel = sourceLabelKey ? t(sourceLabelKey) : run.source
  const sourceTooltipKey = SOURCE_TOOLTIP_KEYS[run.source]
  const sourceTooltip = sourceTooltipKey ? t(sourceTooltipKey) : sourceLabel
  const isCi = isCiRun(run)
  const isManual = run.source === 'manual'
  const { title, subtitle } = runTitleParts(run, suite?.name ?? '')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4 py-1">
        <div className="min-w-0 flex items-center gap-3">
          <StatusChip status={run.status} />
          <div className="min-w-0 space-y-0.5">
            <h3
              title={title}
              className="text-base font-semibold leading-tight tracking-tight text-default truncate"
            >
              {title}
            </h3>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <div className="text-xs font-medium text-muted">{t('runs.passRate')}</div>
            <div className="text-base font-mono font-semibold tabular-nums text-default">
              {passRateDisplay}
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger
              data-testid="run-source-chip"
              render={
                <span
                  tabIndex={0}
                  aria-label={sourceLabel}
                  className={
                    isCi
                      ? 'inline-flex min-h-6 min-w-6 items-center justify-center rounded text-brand-github-actions focus-visible:outline-2 focus-visible:outline-primary'
                      : isManual
                        ? 'inline-flex min-h-6 min-w-6 items-center justify-center rounded text-primary focus-visible:outline-2 focus-visible:outline-primary'
                        : 'inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border border-border/80 bg-canvas px-2.5 py-1 text-xs font-semibold text-default focus-visible:outline-2 focus-visible:outline-primary'
                  }
                />
              }
            >
              {isCi ? (
                <GithubActionsIcon className="size-4" aria-hidden="true" />
              ) : isManual ? (
                <QablyMarkIcon className="size-4" aria-hidden="true" />
              ) : (
                sourceLabel
              )}
            </TooltipTrigger>
            <TooltipContent>{sourceTooltip}</TooltipContent>
          </Tooltip>
          <div className="hidden sm:block text-right">
            <div className="text-xs font-medium text-muted">{t('runs.started')}</div>
            <div className="text-sm text-default">{formatDate(run.startedAt)}</div>
          </div>
          {run.finishedAt && (
            <div className="hidden sm:block text-right">
              <div className="text-xs font-medium text-muted">{t('runs.finished')}</div>
              <div className="text-sm text-default">{formatDate(run.finishedAt)}</div>
            </div>
          )}
        </div>
      </div>

      {run.source === 'github_actions' && run.commitSha && (
        <div
          className="flex items-start gap-3 py-1.5"
          data-testid="run-commit-info"
        >
          <GitCommit
            size={16}
            weight="duotone"
            className="text-muted shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="font-mono">{run.commitSha.slice(0, 7)}</span>
              {run.commitAuthor && (
                <span>
                  {t('runs.byAuthor')}<span className="text-default">{run.commitAuthor}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
