'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { formatRelativeTime } from '@/features/dashboard/lib/format'
import { useTranslation } from '@/lib/i18n'
import { DataTable } from '@/components/ui/data-table'

export function ProjectHealthTable() {
  const stats = useDashboardStats()
  const { t } = useTranslation()

  return (
    <Card className="col-span-1 border border-border/80 flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between pb-4 p-5">
        <CardTitle className="text-sm font-semibold text-default">{t('dashboard.projectHealth')}</CardTitle>
        <Link
          href="/projects"
          className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-all duration-150 cursor-pointer"
        >
          {t('common.viewAll')}
        </Link>
      </CardHeader>
      
      <CardContent className="p-0 flex-1">
        <DataTable caption={t('dashboard.projectHealth')} className="min-w-[400px]">
          <thead>
            <tr className="border-b border-border bg-canvas/40">
              <th className="text-xs font-medium text-muted px-5 py-3">{t('dashboard.thProject')}</th>
              <th className="text-xs font-medium text-muted px-3 py-3">{t('dashboard.thHealth')}</th>
              <th className="text-xs font-medium text-muted px-3 py-3">{t('dashboard.thLastRun')}</th>
              <th className="text-xs font-medium text-muted px-3 py-3 text-center">{t('dashboard.thSuites')}</th>
              <th className="text-xs font-medium text-muted px-5 py-3 text-center">{t('dashboard.thAiPending')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {stats.projectsByHealth.map(({ project }) => {
              const { activity } = project
              return (
                <tr
                  key={project.id}
                  className="hover:bg-canvas/20 transition-colors group"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-xs font-semibold text-default hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5">
                    {activity ? (
                      <div className="flex items-center gap-2">
                        <StatusChip status={activity.lastRunStatus} />
                        <span className="text-xs text-muted-foreground">
                          <span className="font-semibold text-default tabular-nums font-mono">
                            {activity.healthScore}%
                          </span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">{t('dashboard.noRuns')}</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-xs text-muted-foreground">
                    {activity ? formatRelativeTime(activity.lastRunAt) : '—'}
                  </td>
                  <td className="px-3 py-3.5 text-xs font-medium text-default text-center tabular-nums font-mono">
                    {project.suiteCount}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-medium text-default text-center tabular-nums font-mono">
                    {activity ? (
                      activity.aiPendingCount > 0 ? (
                        <span className="text-primary font-semibold">{activity.aiPendingCount}</span>
                      ) : (
                        <span className="text-muted-foreground/60">{activity.aiPendingCount}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      </CardContent>
    </Card>
  )
}
