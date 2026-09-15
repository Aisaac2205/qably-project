'use client'

import { StatusDonut, type StatusDonutSlice, type StatusDonutTone } from '@qably/ui/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useTranslation } from '@/lib/i18n'

const STATUS_ORDER: { status: string; tone: StatusDonutTone; labelKey: string }[] = [
  { status: 'pass', tone: 'pass', labelKey: 'status.execution.pass' },
  { status: 'fail', tone: 'fail', labelKey: 'status.execution.fail' },
  { status: 'running', tone: 'running', labelKey: 'status.execution.running' },
  { status: 'pending', tone: 'muted', labelKey: 'status.execution.pending' },
  { status: 'never-run', tone: 'muted', labelKey: 'status.execution.neverRun' },
]

export function ProjectStatusDonut() {
  const stats = useDashboardStats()
  const { t } = useTranslation()

  const counts = new Map<string, number>()
  for (const { project } of stats.projectsByHealth) {
    const status = project.activity?.lastRunStatus ?? 'never-run'
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }

  const slices: StatusDonutSlice[] = STATUS_ORDER.map(({ status, tone, labelKey }) => ({
    id: status,
    label: t(labelKey),
    count: counts.get(status) ?? 0,
    tone,
  }))

  return (
    <Card className="flex flex-col border border-border/80">
      <CardHeader className="pb-2">
        <CardTitle>{t('dashboard.projectsByStatus')}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {stats.projectsState.isError ? (
          <StateView
            kind="error"
            title={t('dashboard.loadErrorTitle')}
            description={t('dashboard.loadErrorDescription')}
            action={
              <Button type="button" variant="outline" size="sm" onClick={stats.projectsState.retry}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : stats.projectsState.isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : (
          <StatusDonut
            slices={slices}
            label={t('dashboard.projectsByStatus')}
            emptyLabel={t('projects.noProjects')}
          />
        )}
      </CardContent>
    </Card>
  )
}
