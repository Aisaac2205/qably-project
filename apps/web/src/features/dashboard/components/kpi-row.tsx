'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Play, Bug, Sparkle, CircleNotch } from '@phosphor-icons/react'
import { KpiCard, type KpiSparkline } from '@qably/ui/dashboard'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useTranslation } from '@/lib/i18n'

const SKELETON_COUNT = 4
const MIN_SPARKLINE_POINTS = 2

export function KpiRow() {
  const stats = useDashboardStats()
  const { t } = useTranslation()
  const detailsLabel = t('common.viewDetails')

  const defectsSparkline: KpiSparkline | undefined = useMemo(() => {
    const values = [...stats.recentRuns]
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      .map((run) => run.caseCounts.fail)

    if (values.length < MIN_SPARKLINE_POINTS) return undefined

    return {
      values,
      label: t('dashboard.defectsSparkline', { count: values.length }),
      tone: stats.defectsDetected > 0 ? 'fail' : 'muted',
    }
  }, [stats.recentRuns, stats.defectsDetected, t])

  if (stats.summaryState.isLoading) {
    return (
      <section aria-label="Quality overview" className="min-w-0 @container">
        <dl className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <Skeleton key={index} className="h-[120px] rounded-xl" />
          ))}
        </dl>
      </section>
    )
  }

  if (stats.summaryState.isError) {
    return (
      <section aria-label="Quality overview" className="min-w-0 @container">
        <Card>
          <StateView
            kind="error"
            title={t('dashboard.loadErrorTitle')}
            description={t('dashboard.loadErrorDescription')}
            action={
              <Button type="button" variant="outline" size="sm" onClick={stats.summaryState.retry}>
                {t('common.retry')}
              </Button>
            }
          />
        </Card>
      </section>
    )
  }

  return (
    <section aria-label="Quality overview" className="min-w-0 @container">
      <dl className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <KpiCard
          label={t('dashboard.runsKpi')}
          value={stats.runsLast7d}
          icon={Play}
          href="/projects"
          linkComponent={Link}
          detailsLabel={detailsLabel}
        />
        <KpiCard
          label={t('dashboard.defectsKpi', { windowDays: stats.windowDays })}
          value={stats.defectsDetected}
          icon={Bug}
          href="/projects"
          linkComponent={Link}
          detailsLabel={detailsLabel}
          accent={stats.defectsDetected > 0 ? 'fail' : 'default'}
          sparkline={defectsSparkline}
        />
        <KpiCard
          label={t('dashboard.pendingAiKpi')}
          value={stats.pendingProposals}
          icon={Sparkle}
          href="/review-inbox"
          linkComponent={Link}
          detailsLabel={detailsLabel}
          accent="ai"
        />
        <KpiCard
          label={t('dashboard.activeRunsKpi')}
          value={stats.activeRuns}
          icon={CircleNotch}
          href="/projects"
          linkComponent={Link}
          detailsLabel={detailsLabel}
          accent={stats.activeRuns > 0 ? 'running' : 'default'}
        />
      </dl>
    </section>
  )
}
