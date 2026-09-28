'use client'

import { useMemo } from 'react'
import type { DashboardPeriod } from '@qably/types'
import {
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
  Legend,
  LegendItemComponent,
  LegendLabel,
  LegendMarker,
  StackedBar,
  type LegendItemData,
} from '@/components/charts'
import { ChartDataTable } from '@qably/ui/dashboard'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import { formatSeriesRange } from '@/features/dashboard/lib/series-date'
import { useTranslation } from '@/lib/i18n'

export interface DailyActivityBarChartProps {
  projectId: string
  period: DashboardPeriod
}

interface ActivityBucket extends Record<string, unknown> {
  day: string
  passed: number
  failed: number
  blocked: number
  total: number
}

const PASS_COLOR = 'var(--qb-chart-pass)'
const FAIL_COLOR = 'var(--qb-chart-fail)'
const BLOCKED_COLOR = 'var(--qb-chart-warn)'
const TOTAL_COLOR = 'var(--qb-chart-compare)'

export function DailyActivityBarChart({ projectId, period }: DailyActivityBarChartProps) {
  const { t, locale } = useTranslation()
  const { overview, isLoading, isError, retry } = useDashboardOverview(period, projectId)

  const granularity = overview?.passRateSeries.granularity ?? 'day'

  const labels = {
    passed: t('dashboard.heroMetricPassed'),
    failed: t('dashboard.heroMetricFailed'),
    blocked: t('dashboard.heroMetricBlocked'),
    total: t('dashboard.casesTotalLabel'),
    day: t('dashboard.heroDayLabel'),
  }

  const buckets = useMemo<ActivityBucket[]>(() => {
    const currentPoints = overview?.passRateSeries.current ?? []
    return currentPoints.map((p) => ({
      day: formatSeriesRange(p, granularity, locale),
      passed: p.passed,
      failed: p.failed,
      blocked: p.blocked,
      total: p.passed + p.failed + p.blocked,
    }))
  }, [overview?.passRateSeries.current, granularity, locale])

  const totalActivity = useMemo(() => buckets.reduce((sum, bucket) => sum + bucket.total, 0), [buckets])

  const legendItems: LegendItemData[] = useMemo(() => {
    const totals = buckets.reduce(
      (acc, bucket) => ({
        passed: acc.passed + bucket.passed,
        failed: acc.failed + bucket.failed,
        blocked: acc.blocked + bucket.blocked,
      }),
      { passed: 0, failed: 0, blocked: 0 },
    )
    const maxValue = totalActivity || 1

    return [
      { label: labels.passed, value: totals.passed, maxValue, color: PASS_COLOR },
      { label: labels.failed, value: totals.failed, maxValue, color: FAIL_COLOR },
      { label: labels.blocked, value: totals.blocked, maxValue, color: BLOCKED_COLOR },
    ]
  }, [buckets, totalActivity, labels.passed, labels.failed, labels.blocked])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <StateView
          kind="error"
          title={t('quality.loadErrorTitle')}
          description={t('quality.loadErrorDescription')}
          action={
            <button
              type="button"
              className="text-xs font-semibold text-primary underline"
              onClick={retry}
            >
              {t('common.retry')}
            </button>
          }
        />
      </div>
    )
  }

  return (
    <section
      aria-labelledby="quality-activity-heading"
      className="@container rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4"
    >
      <div className="min-w-0">
        <h2
          id="quality-activity-heading"
          className="text-base font-semibold tracking-[-0.015em] text-default"
        >
          {t('quality.activityHeading')}
        </h2>
        <p className="text-xs text-muted">{t('quality.activityCaption', { count: period })}</p>
      </div>

      {totalActivity === 0 ? (
        <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-6 text-center">
          <p className="text-sm font-medium text-muted">{t('quality.trendEmptyTitle')}</p>
          <p className="mt-1 text-xs text-muted/70">{t('quality.trendEmptyDescription')}</p>
        </div>
      ) : (
        <>
          <div className="w-full overflow-hidden">
            <BarChart
              aspectRatio="auto"
              barGap={0.15}
              className="w-full"
              data={buckets}
              margin={{ top: 12, right: 12, bottom: 28, left: 12 }}
              style={{ height: 220 }}
              xDataKey="day"
            >
              <Grid horizontal />
              <StackedBar
                dataKey="total"
                segments={[
                  { dataKey: 'passed', fill: PASS_COLOR },
                  { dataKey: 'failed', fill: FAIL_COLOR },
                  { dataKey: 'blocked', fill: BLOCKED_COLOR },
                ]}
              />
              <BarXAxis maxLabels={8} />
              <ChartTooltip
                rows={(point) => [
                  { color: PASS_COLOR, label: labels.passed, value: Number(point.passed ?? 0) },
                  { color: FAIL_COLOR, label: labels.failed, value: Number(point.failed ?? 0) },
                  { color: BLOCKED_COLOR, label: labels.blocked, value: Number(point.blocked ?? 0) },
                  { color: TOTAL_COLOR, label: labels.total, value: Number(point.total ?? 0) },
                ]}
                showDots={false}
              />
            </BarChart>
          </div>

          <Legend items={legendItems}>
            <LegendItemComponent>
              <LegendMarker />
              <LegendLabel />
            </LegendItemComponent>
          </Legend>

          <ChartDataTable
            caption={t('quality.activityTableCaption')}
            columns={[
              { key: 'day', header: labels.day, render: (row) => row.day },
              { key: 'passed', header: labels.passed, render: (row) => row.passed },
              { key: 'failed', header: labels.failed, render: (row) => row.failed },
              { key: 'blocked', header: labels.blocked, render: (row) => row.blocked },
              { key: 'total', header: labels.total, render: (row) => row.total },
            ]}
            rowKey={(row) => row.day}
            rows={buckets}
          />
        </>
      )}
    </section>
  )
}
