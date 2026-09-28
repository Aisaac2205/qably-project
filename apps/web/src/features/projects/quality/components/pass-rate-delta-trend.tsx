'use client'

import { useMemo } from 'react'
import type { PushPassRateCandle } from '@qably/types'
import { LineChart } from '@/components/charts/line-chart'
import { Line } from '@/components/charts/line'
import { ProfitLossLine } from '@/components/charts/profit-loss-line'
import { Grid } from '@/components/charts/grid'
import { XAxis } from '@/components/charts/x-axis'
import { YAxis } from '@/components/charts/y-axis'
import { ChartTooltip } from '@/components/charts/tooltip'
import { ChartDataTable } from '@qably/ui/dashboard'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { usePushPassRate } from '@/features/runs/hooks/use-runs'
import { useTranslation } from '@/lib/i18n'

export interface PassRateDeltaTrendProps {
  projectId: string
  days?: number
}

const IMPROVED_COLOR = 'var(--qb-chart-pass)'
const REGRESSED_COLOR = 'var(--qb-chart-fail)'
const NEUTRAL_COLOR = 'var(--qb-chart-compare)'
const SKIPPED_COLOR = 'var(--qb-chart-skip)'
const DEFAULT_DAYS = 30

interface PushDelta extends Record<string, unknown> {
  id: string
  shortSha: string
  date: Date
  delta: number
  passRate: number
  previousPassRate: number
  runCount: number
  executed: number
  passed: number
  failed: number
  blocked: number
  skipped: number
}

function buildDeltas(candles: readonly PushPassRateCandle[]): PushDelta[] {
  const deltas: PushDelta[] = []

  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index]
    const previous = candles[index - 1]
    if (!candle || !previous) continue

    const passRate = candle.passRate * 100
    const previousPassRate = previous.passRate * 100
    const decided = candle.passed + candle.failed + candle.blocked

    deltas.push({
      id: candle.commitSha,
      shortSha: candle.shortSha,
      date: new Date(candle.startedAt),
      delta: passRate - previousPassRate,
      passRate,
      previousPassRate,
      runCount: candle.runCount,
      executed: candle.executed,
      passed: candle.passed,
      failed: candle.failed,
      blocked: candle.blocked,
      skipped: Math.max(candle.executed - decided, 0),
    })
  }

  return deltas
}

function formatDelta(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (rounded === 0) return '0%'
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

export function PassRateDeltaTrend({ projectId, days = DEFAULT_DAYS }: PassRateDeltaTrendProps) {
  const { candles, isLoading, isError, refetch } = usePushPassRate(projectId, days)
  const { t, locale } = useTranslation()
  const bcpLocale = locale === 'es' ? 'es-ES' : 'en-US'

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(bcpLocale, { month: 'short', day: 'numeric' }),
    [bcpLocale],
  )

  const points = useMemo(() => buildDeltas(candles), [candles])

  const labels = {
    delta: t('quality.pushDeltaHeader'),
    deltaColumn: t('quality.pushDeltaLabel'),
    passRate: t('quality.pushPassRateLabel'),
    tooltipCases: t('quality.pushTooltipCases'),
    tooltipRuns: t('quality.pushTooltipRuns'),
    cases: t('quality.pushCasesLabel'),
    failed: t('quality.pushFailedLabel'),
    blocked: t('status.execution.blocked'),
    skipped: t('status.execution.skip'),
    runs: t('quality.pushRunCountLabel'),
  }

  if (isError) {
    return (
      <StateView
        kind="error"
        title={t('quality.loadErrorTitle')}
        description={t('quality.loadErrorDescription')}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    )
  }

  if (isLoading) {
    return <Skeleton className="h-80 w-full rounded-lg" />
  }

  if (candles.length === 0) {
    return (
      <StateView
        kind="empty"
        title={t('quality.pushEmptyTitle')}
        description={t('quality.pushEmptyDescription')}
      />
    )
  }

  if (points.length === 0) {
    return (
      <StateView
        kind="empty"
        title={t('quality.pushDeltaEmptyTitle')}
        description={t('quality.pushDeltaEmptyDescription')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-default">
        {t('quality.pushDeltaCaption', { count: days })}
      </p>
      <LineChart
        aspectRatio="auto"
        className="w-full"
        data={points}
        margin={{ top: 8, right: 8, bottom: 40, left: 52 }}
        style={{ height: 320 }}
      >
        <Grid highlightRowValues={[0]} horizontal />
        <Line dataKey="delta" showHighlight={false} stroke="transparent" strokeWidth={0} />
        <ProfitLossLine
          dataKey="delta"
          negativeColor={REGRESSED_COLOR}
          positiveColor={IMPROVED_COLOR}
        />
        <XAxis />
        <YAxis formatValue={(value) => formatDelta(Number(value))} />
        <ChartTooltip
          indicatorColor={(point) =>
            Number(point.delta ?? 0) === 0
              ? NEUTRAL_COLOR
              : Number(point.delta ?? 0) > 0
                ? IMPROVED_COLOR
                : REGRESSED_COLOR
          }
          rows={(point) => {
            const delta = Number(point.delta ?? 0)
            const color = delta === 0 ? NEUTRAL_COLOR : delta > 0 ? IMPROVED_COLOR : REGRESSED_COLOR
            return [
              { color, label: labels.delta, value: formatDelta(delta) },
              {
                color: NEUTRAL_COLOR,
                label: labels.passRate,
                value: `${Math.round(Number(point.passRate ?? 0) * 10) / 10}%`,
              },
              {
                color: NEUTRAL_COLOR,
                label: labels.tooltipCases,
                value: `${point.passed ?? 0}/${point.executed ?? 0}${
                  point.failed ? ` (${point.failed} ${labels.failed})` : ''
                }`,
              },
              ...(Number(point.blocked ?? 0) > 0
                ? [{ color: 'var(--qb-chart-warn)', label: labels.blocked, value: `${point.blocked}` }]
                : []),
              ...(Number(point.skipped ?? 0) > 0
                ? [{ color: SKIPPED_COLOR, label: labels.skipped, value: `${point.skipped}` }]
                : []),
              { color: NEUTRAL_COLOR, label: labels.tooltipRuns, value: `${point.runCount ?? 0}` },
            ]
          }}
          showCrosshair
          showDots={false}
        />
      </LineChart>

      <ChartDataTable
        caption={t('quality.pushDeltaCaption', { count: days })}
        rows={points}
        rowKey={(point) => point.id}
        columns={[
          {
            key: 'date',
            header: t('quality.trendDateHeader'),
            render: (point) => dateFormatter.format(point.date),
          },
          { key: 'commit', header: 'Commit', render: (point) => point.shortSha },
          {
            key: 'delta',
            header: t('quality.pushDeltaHeader'),
            render: (point) => formatDelta(point.delta),
          },
          {
            key: 'passRate',
            header: labels.passRate,
            render: (point) => `${Math.round(point.passRate * 10) / 10}%`,
          },
          {
            key: 'cases',
            header: labels.cases,
            render: (point) => `${point.passed}/${point.executed}`,
          },
          { key: 'runs', header: labels.runs, render: (point) => point.runCount },
        ]}
      />
    </div>
  )
}
