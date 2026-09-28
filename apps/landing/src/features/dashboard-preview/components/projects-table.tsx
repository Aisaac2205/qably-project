import React from 'react'
import type { DashboardOverviewRecord } from '@qably/types'
import { Card } from '@/components/ui/card'
import { sortDashboardProjects } from '../lib/dashboard-projects'
import { formatKpiValue, formatRelativeTime, type FormatLocale } from '../lib/format'
import { ProjectMonogram } from './project-monogram'
import { PassRateBar } from './pass-rate-bar'
import { useTranslation } from '@/lib/i18n'

export interface ProjectsTableProps {
  overview: DashboardOverviewRecord
}

export function ProjectsTable({ overview }: ProjectsTableProps) {
  const { t, locale } = useTranslation()
  const timeLocale: FormatLocale = locale === 'en' ? 'en' : 'es'
  const title = t('dashboard.projectsTitle')

  return (
    <Card as="section" aria-labelledby="projects-table-heading" className="@container flex h-full flex-col overflow-hidden">
      <h2 id="projects-table-heading" className="sr-only">
        {title}
      </h2>

      <div className="w-full pb-2">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-canvas/30 text-sm font-medium text-muted">
              <th scope="col" className="py-3 pl-5 pr-3 text-sm font-medium text-muted">
                {t('dashboard.projectsColProject')}
              </th>
              <th scope="col" className="hidden @lg:table-cell w-24 py-3 px-3 text-center text-sm font-medium text-muted">
                {t('dashboard.projectsColSuites')}
              </th>
              <th scope="col" className="hidden @lg:table-cell w-24 py-3 px-3 text-center text-sm font-medium text-muted">
                {t('dashboard.projectsColCases')}
              </th>
              <th scope="col" className="w-40 py-3 pl-3 pr-5 text-right text-sm font-medium text-muted">
                {t('dashboard.projectsColPassRate')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sortDashboardProjects(overview.projects).map((project) => {
              const barValue = project.passRate === null ? null : Math.round(project.passRate * 100)
              const passRateText = formatKpiValue('passRate', project.passRate)

              return (
                <tr
                  key={project.id}
                  className="group transition-colors duration-150 ease-out hover:bg-canvas-hover/50"
                >
                  <td className="min-w-48 py-3.5 pl-5 pr-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProjectMonogram
                        projectId={project.id}
                        name={project.name}
                        className="size-8 text-xs font-bold transition-transform duration-150 ease-out group-hover:scale-105"
                      />
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-default transition-colors duration-150 ease-out">
                          {project.name}
                        </span>
                        <p className="truncate text-xs text-muted tabular-nums mt-0.5">
                          {project.lastRunAt === undefined
                            ? t('dashboard.noRuns')
                            : t('dashboard.projectsLastRunLabel', {
                                time: formatRelativeTime(project.lastRunAt, timeLocale),
                              })}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden @lg:table-cell w-24 py-3.5 px-3 text-center text-sm font-semibold text-default tabular-nums font-mono">
                    {project.suites}
                  </td>
                  <td className="hidden @lg:table-cell w-24 py-3.5 px-3 text-center text-sm font-semibold text-default tabular-nums font-mono">
                    {project.cases}
                  </td>
                  <td className="py-3.5 pl-3 pr-5">
                    <div className="flex items-center gap-2.5">
                      <PassRateBar
                        value={barValue}
                        label={t('dashboard.projectsRowPassRateLabel', { name: project.name })}
                        className="h-2 flex-1"
                      />
                      <span className="w-12 text-right text-sm font-semibold text-default tabular-nums font-mono">
                        {passRateText}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
