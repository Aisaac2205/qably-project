'use client'

import { KpiTile, Sparkline, type KpiTileDelta } from '@qably/ui/dashboard'
import type { DashboardPeriod } from '@qably/types'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import { DASHBOARD_KPI_POLARITY, resolveKpiDeltaTone } from '@/features/dashboard/lib/kpi-delta'
import { formatKpiDelta, formatKpiValue, type DashboardKpiMetric } from '@/features/dashboard/lib/format'
import { useTranslation } from '@/lib/i18n'

const SKELETON_COUNT = 4

export interface KpiStripProps {
  period: DashboardPeriod
  projectId?: string
}

function buildDelta(
  metric: DashboardKpiMetric,
  value: number | null,
  previous: number | null,
  label: string,
  compare: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): KpiTileDelta | undefined {
  const text = formatKpiDelta(metric, value, previous)
  if (text === null) return undefined

  return {
    text,
    tone: resolveKpiDeltaTone(value, previous, DASHBOARD_KPI_POLARITY[metric]),
    srText: t('dashboard.kpiDeltaSr', { label, delta: text, compare }),
  }
}

function StripShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="mx-auto min-w-0 w-full max-w-dashboard @container">
      {children}
    </section>
  )
}

export function KpiStrip({ period, projectId }: KpiStripProps) {
  const { overview, isLoading, isError, retry } = useDashboardOverview(period, projectId)
  const { t } = useTranslation()
  const stripLabel = t('dashboard.kpiStripLabel')

  if (isLoading) {
    return (
      <StripShell label={stripLabel}>
        <dl className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <Skeleton key={index} className="h-[120px] rounded-xl" />
          ))}
        </dl>
      </StripShell>
    )
  }

  if (isError || overview === undefined) {
    return (
      <StripShell label={stripLabel}>
        <Card>
          <StateView
            kind="error"
            title={t('dashboard.loadErrorTitle')}
            description={t('dashboard.loadErrorDescription')}
            action={
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                {t('common.retry')}
              </Button>
            }
          />
        </Card>
      </StripShell>
    )
  }

  if (overview.kpis.runs.value === 0) {
    return (
      <StripShell label={stripLabel}>
        <Card>
          <StateView kind="empty" title={t('dashboard.kpiEmptyTitle')} />
        </Card>
      </StripShell>
    )
  }

  const compare = t('dashboard.kpiCompareLabel', { count: period })
  const passRateLabel = t('dashboard.kpiPassRateLabel')
  const runsLabel = t('dashboard.kpiRunsLabel')
  const failedCasesLabel = t('dashboard.kpiFailedCasesLabel')
  const avgDurationLabel = t('dashboard.kpiAvgDurationLabel')

  return (
    <StripShell label={stripLabel}>
      <dl className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-4">
        <KpiTile
          label={passRateLabel}
          value={formatKpiValue('passRate', overview.kpis.passRate.value)}
          delta={buildDelta(
            'passRate',
            overview.kpis.passRate.value,
            overview.kpis.passRate.previous,
            passRateLabel,
            compare,
            t,
          )}
        >
          <Sparkline
            values={overview.kpis.passRate.series}
            label={t('dashboard.kpiSparklineLabel', { label: passRateLabel })}
            emptyLabel={t('dashboard.kpiSparklineEmpty')}
            tone="pass"
          />
        </KpiTile>

        <KpiTile
          label={runsLabel}
          value={formatKpiValue('runs', overview.kpis.runs.value)}
          delta={buildDelta(
            'runs',
            overview.kpis.runs.value,
            overview.kpis.runs.previous,
            runsLabel,
            compare,
            t,
          )}
        >
          <Sparkline
            values={overview.kpis.runs.series}
            label={t('dashboard.kpiSparklineLabel', { label: runsLabel })}
            emptyLabel={t('dashboard.kpiSparklineEmpty')}
            tone="primary"
          />
        </KpiTile>

        <KpiTile
          label={failedCasesLabel}
          value={formatKpiValue('failedCases', overview.kpis.failedCases.value)}
          delta={buildDelta(
            'failedCases',
            overview.kpis.failedCases.value,
            overview.kpis.failedCases.previous,
            failedCasesLabel,
            compare,
            t,
          )}
        >
          <Sparkline
            values={overview.kpis.failedCases.series}
            label={t('dashboard.kpiSparklineLabel', { label: failedCasesLabel })}
            emptyLabel={t('dashboard.kpiSparklineEmpty')}
            tone={(overview.kpis.failedCases.value ?? 0) > 0 ? 'fail' : 'muted'}
          />
        </KpiTile>

        <KpiTile
          label={avgDurationLabel}
          value={formatKpiValue('avgRunDurationMs', overview.kpis.avgRunDurationMs.value)}
          delta={buildDelta(
            'avgRunDurationMs',
            overview.kpis.avgRunDurationMs.value,
            overview.kpis.avgRunDurationMs.previous,
            avgDurationLabel,
            compare,
            t,
          )}
        >
          <Sparkline
            values={overview.kpis.avgRunDurationMs.series}
            label={t('dashboard.kpiSparklineLabel', { label: avgDurationLabel })}
            emptyLabel={t('dashboard.kpiSparklineEmpty')}
            tone="muted"
          />
        </KpiTile>
      </dl>
    </StripShell>
  )
}
