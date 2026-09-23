'use client'

import type { DashboardPeriod } from '@qably/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import { ActivityRow } from '@/features/dashboard/components/activity-row'
import { useTranslation } from '@/lib/i18n'

const SKELETON_ROWS = 4

export interface ActivityCardProps {
  period: DashboardPeriod
  projectId?: string
}

function ActivityCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-5 pb-5">
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  )
}

export function ActivityCard({ period, projectId }: ActivityCardProps) {
  const { overview, isLoading, isError, retry } = useDashboardOverview(period, projectId)
  const { t } = useTranslation()
  const title = t('dashboard.activityTitle')

  return (
    <Card as="section" aria-labelledby="activity-card-heading" className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle as="h3" id="activity-card-heading">
          {title}
        </CardTitle>
      </CardHeader>

      {isError ? (
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
      ) : isLoading || overview === undefined ? (
        <ActivityCardSkeleton />
      ) : overview.recentRuns.length === 0 ? (
        <StateView kind="empty" title={t('dashboard.activityEmptyTitle')} />
      ) : (
        <div className="flex flex-col divide-y divide-border px-5 pb-2">
          {overview.recentRuns.map((run) => (
            <ActivityRow key={run.id} run={run} />
          ))}
        </div>
      )}
    </Card>
  )
}
