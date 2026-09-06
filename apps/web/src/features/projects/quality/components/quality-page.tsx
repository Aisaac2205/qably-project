'use client'

import { ChartLine, CircleNotch, Play, Sparkle, WarningCircle } from '@phosphor-icons/react'
import type { RunSummaryRecord } from '@qably/types'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { PageHeader } from '@/components/ui/page-header'
import { StateView } from '@/components/ui/state-view'
import { TraceabilitySection } from '@/features/dashboard/components/traceability-section'
import { useDashboardSummary } from '@/features/dashboard/hooks/use-dashboard-summary'
import { useProject } from '@/features/projects/hooks/use-project'
import { projectRootPath } from '@/features/projects/lib/routes'
import { useProposals } from '@/features/review-inbox/hooks/use-proposals'
import { useRecentRuns, useRegressions, useSuiteMetricsQuery } from '@/features/runs/hooks/use-runs'
import { useTranslation } from '@/lib/i18n'
import { PassRateTrendFigure } from './pass-rate-trend-figure'
import { RegressionsList } from './regressions-list'
import { SuitesHealthTable } from './suites-health-table'

const SHELL_CLASSES =
  'w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter'
const REGRESSIONS_ANCHOR = 'quality-regressions'
const TREND_RUN_LIMIT = 30

function buildSuiteNames(...sources: RunSummaryRecord[][]): Map<string, string> {
  const names = new Map<string, string>()
  for (const list of sources) {
    for (const run of list) {
      if (!names.has(run.suiteId)) names.set(run.suiteId, run.suiteName)
    }
  }
  return names
}

interface RetryStateViewProps {
  title: string
  description: string
  onRetry: () => void
  retryLabel: string
}

function RetryStateView({ title, description, onRetry, retryLabel }: RetryStateViewProps) {
  return (
    <StateView
      kind="error"
      title={title}
      description={description}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      }
    />
  )
}

export function QualityPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { project } = useProject(projectId)
  const summaryQuery = useDashboardSummary(projectId)
  const recentRuns = useRecentRuns(projectId, TREND_RUN_LIMIT)
  const regressionsQuery = useRegressions(projectId)
  const suiteMetrics = useSuiteMetricsQuery(projectId)
  const proposalsQuery = useProposals({ projectId, status: 'in_review' })

  if (summaryQuery.isLoading) {
    return (
      <div className={SHELL_CLASSES}>
        <StateView kind="loading" title={t('quality.loading')} />
      </div>
    )
  }

  if (summaryQuery.isError || summaryQuery.summary === undefined) {
    return (
      <div className={SHELL_CLASSES}>
        <RetryStateView
          title={t('quality.loadErrorTitle')}
          description={t('quality.loadErrorDescription')}
          retryLabel={t('common.retry')}
          onRetry={() => void summaryQuery.refetch()}
        />
      </div>
    )
  }

  const summary = summaryQuery.summary
  const passRatePercent = Math.round(summary.passRate * 100)
  const passRateTrendPercent = Math.round(summary.passRateTrend * 100)
  const regressionsCount = regressionsQuery.regressions.length
  const pendingProposalsCount = proposalsQuery.proposals.length

  const trendPoints = recentRuns.runs
    .filter((run) => run.status === 'pass' || run.status === 'fail')
    .slice()
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .map((run) => ({ date: run.startedAt, passRate: run.passRate * 100 }))

  const suiteNames = buildSuiteNames(summary.recentRuns, recentRuns.runs)

  return (
    <div className={SHELL_CLASSES}>
      <Breadcrumbs
        items={[
          { label: t('suites.breadcrumbProjects'), href: '/projects' },
          ...(project ? [{ label: project.name, href: projectRootPath(projectId) }] : []),
          { label: t('quality.breadcrumb') },
        ]}
      />

      <PageHeader title={project?.name ?? t('quality.breadcrumb')} />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label={t('quality.kpiPassRate')}
          value={`${passRatePercent}%`}
          icon={ChartLine}
          href={`/projects/${projectId}/runs`}
          trend={{
            value: passRateTrendPercent,
            label: t('quality.kpiPassRateTrendLabel'),
            isPercentage: true,
          }}
        />
        <KpiCard
          label={t('quality.kpiRunsInWindow')}
          value={summary.runsInWindow}
          icon={Play}
          href={`/projects/${projectId}/runs`}
        />
        <KpiCard
          label={t('quality.kpiActiveRuns')}
          value={summary.activeRuns}
          icon={CircleNotch}
          href={`/projects/${projectId}/runs`}
        />
        <KpiCard
          label={t('quality.kpiRegressions')}
          value={regressionsQuery.isLoading ? '—' : regressionsCount}
          icon={WarningCircle}
          href={`#${REGRESSIONS_ANCHOR}`}
          accent={regressionsCount > 0 ? 'fail' : 'default'}
        />
        <KpiCard
          label={t('quality.kpiPendingProposals')}
          value={proposalsQuery.isLoading ? '—' : pendingProposalsCount}
          icon={Sparkle}
          href={`/projects/${projectId}/ai-review`}
          accent="ai"
        />
      </dl>

      <section
        aria-labelledby="quality-trend-heading"
        className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5"
      >
        <h2 id="quality-trend-heading" className="sr-only">
          {t('quality.trendHeading')}
        </h2>
        {recentRuns.isLoading ? (
          <StateView kind="loading" title={t('quality.loading')} />
        ) : recentRuns.isError ? (
          <RetryStateView
            title={t('quality.loadErrorTitle')}
            description={t('quality.loadErrorDescription')}
            retryLabel={t('common.retry')}
            onRetry={() => void recentRuns.refetch()}
          />
        ) : (
          <PassRateTrendFigure points={trendPoints} />
        )}
      </section>

      <section id={REGRESSIONS_ANCHOR} aria-labelledby="quality-regressions-heading" className="space-y-3">
        <h2
          id="quality-regressions-heading"
          className="text-base font-semibold tracking-[-0.015em] text-default"
        >
          {t('quality.regressionsHeading')}
        </h2>
        {regressionsQuery.isLoading ? (
          <StateView kind="loading" title={t('quality.loading')} />
        ) : regressionsQuery.isError ? (
          <RetryStateView
            title={t('quality.loadErrorTitle')}
            description={t('quality.loadErrorDescription')}
            retryLabel={t('common.retry')}
            onRetry={() => void regressionsQuery.refetch()}
          />
        ) : (
          <RegressionsList
            projectId={projectId}
            regressions={regressionsQuery.regressions}
            runsScanned={regressionsQuery.runsScanned}
          />
        )}
      </section>

      <section aria-labelledby="quality-suites-heading" className="space-y-3">
        <h2
          id="quality-suites-heading"
          className="text-base font-semibold tracking-[-0.015em] text-default"
        >
          {t('quality.suitesHeading')}
        </h2>
        {suiteMetrics.isLoading ? (
          <StateView kind="loading" title={t('quality.loading')} />
        ) : suiteMetrics.isError ? (
          <RetryStateView
            title={t('quality.loadErrorTitle')}
            description={t('quality.loadErrorDescription')}
            retryLabel={t('common.retry')}
            onRetry={() => void suiteMetrics.refetch()}
          />
        ) : (
          <SuitesHealthTable projectId={projectId} items={suiteMetrics.items} suiteNames={suiteNames} />
        )}
      </section>

      <TraceabilitySection projectId={projectId} />
    </div>
  )
}
