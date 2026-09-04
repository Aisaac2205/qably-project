'use client'

import Link from 'next/link'
import type { ProjectListItem } from '@qably/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { formatRelativeTime, type FormatLocale } from '@/features/dashboard/lib/format'
import { sortProjectsByAttention } from '@/features/dashboard/lib/project-attention'
import { useTranslation } from '@/lib/i18n'
import { DataTable } from '@/components/ui/data-table'

function reportsAiPending(projects: readonly ProjectListItem[]): boolean {
  return projects.some((project) => project.activity?.aiPendingCount !== undefined)
}

export function ProjectStatusTable() {
  const stats = useDashboardStats()
  const { t, locale } = useTranslation()
  const timeLocale: FormatLocale = locale === 'en' ? 'en' : 'es'

  const projects = sortProjectsByAttention(
    stats.projectsByHealth.map((entry) => entry.project),
  )
  const showAiColumn = reportsAiPending(projects)
  const title = t('dashboard.projectStatus')

  return (
    <Card className="col-span-1 border border-border/80 flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between pb-4 p-5">
        <CardTitle className="text-sm font-semibold text-default">{title}</CardTitle>
        <Link
          href="/projects"
          className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-all duration-150 cursor-pointer"
        >
          {t('common.viewAll')}
        </Link>
      </CardHeader>

      <CardContent className="p-0 flex-1">
        <DataTable caption={title} className="min-w-[400px]">
          <thead>
            <tr className="border-b border-border bg-canvas/40">
              <th className="text-xs font-medium text-muted px-5 py-3">
                {t('dashboard.thProject')}
              </th>
              <th className="text-xs font-medium text-muted px-3 py-3">
                {t('dashboard.thLastRun')}
              </th>
              <th className="text-xs font-medium text-muted px-3 py-3 text-right">
                {t('dashboard.thPassRate')}
              </th>
              <th
                className={`text-xs font-medium text-muted py-3 text-center ${showAiColumn ? 'px-3' : 'px-5'}`}
              >
                {t('dashboard.thSuites')}
              </th>
              {showAiColumn && (
                <th className="text-xs font-medium text-muted px-5 py-3 text-center">
                  {t('dashboard.thAiPending')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {projects.map((project) => {
              const { activity } = project

              return (
                <tr key={project.id} className="hover:bg-canvas/20 transition-colors group">
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
                        <span className="text-xs text-muted tabular-nums">
                          {formatRelativeTime(activity.lastRunAt, timeLocale)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">{t('dashboard.noRuns')}</span>
                    )}
                  </td>

                  <td className="px-3 py-3.5 text-right">
                    {activity && activity.healthScore !== null ? (
                      <span className="text-xs font-semibold text-default tabular-nums font-mono">
                        {activity.healthScore}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted">
                        {activity ? t('dashboard.notMeasured') : t('dashboard.noRuns')}
                      </span>
                    )}
                  </td>

                  <td
                    className={`py-3.5 text-xs font-medium text-default text-center tabular-nums font-mono ${showAiColumn ? 'px-3' : 'px-5'}`}
                  >
                    {project.suiteCount}
                  </td>

                  {showAiColumn && (
                    <td className="px-5 py-3.5 text-xs font-medium text-center tabular-nums font-mono">
                      {activity?.aiPendingCount === undefined ? (
                        <span className="text-muted">·</span>
                      ) : activity.aiPendingCount > 0 ? (
                        <span className="text-primary font-semibold">
                          {activity.aiPendingCount}
                        </span>
                      ) : (
                        <span className="text-muted">{activity.aiPendingCount}</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      </CardContent>
    </Card>
  )
}
