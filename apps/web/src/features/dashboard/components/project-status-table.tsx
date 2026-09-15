'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CaretUp, CaretDown, CaretUpDown } from '@phosphor-icons/react'
import type { ProjectListItem } from '@qably/types'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { formatRelativeTime, type FormatLocale } from '@/features/dashboard/lib/format'
import {
  sortProjects,
  filterProjectsByName,
  type ProjectSortKey,
  type SortDirection,
} from '@/features/dashboard/lib/sort-projects'
import { useTranslation } from '@/lib/i18n'
import { projectRootPath } from '@/features/projects/lib/routes'

const VISIBLE_LIMIT = 6
const HEADING_ID = 'project-status-heading'
const FILTER_INPUT_ID = 'project-status-filter'

interface SortState {
  key: ProjectSortKey
  dir: SortDirection
}

type SortAria = 'ascending' | 'descending' | 'none'

function reportsAiPending(projects: readonly ProjectListItem[]): boolean {
  return projects.some((project) => project.activity?.aiPendingCount !== undefined)
}

function nextSort(current: SortState, key: ProjectSortKey): SortState {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  return { key, dir: 'asc' }
}

function ariaSortFor(current: SortState, key: ProjectSortKey): SortAria {
  if (current.key !== key) return 'none'
  return current.dir === 'asc' ? 'ascending' : 'descending'
}

function passRateText(
  activity: ProjectListItem['activity'],
  t: (key: string) => string,
): string {
  if (!activity) return t('dashboard.noRuns')
  if (activity.healthScore === null) return t('dashboard.notMeasured')
  return `${activity.healthScore}%`
}

function SortCaret({ state }: { state: SortAria }) {
  if (state === 'ascending') return <CaretUp size={11} weight="bold" aria-hidden="true" />
  if (state === 'descending') return <CaretDown size={11} weight="bold" aria-hidden="true" />
  return <CaretUpDown size={11} weight="bold" className="text-muted/60" aria-hidden="true" />
}

function SortableHeader({
  sort,
  sortKey,
  label,
  ariaLabel,
  onSort,
  className,
  buttonClassName,
}: {
  sort: SortState
  sortKey: ProjectSortKey
  label: string
  ariaLabel: string
  onSort: (key: ProjectSortKey) => void
  className?: string
  buttonClassName?: string
}) {
  const state = ariaSortFor(sort, sortKey)

  return (
    <th className={className} aria-sort={state}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={ariaLabel}
        className={`inline-flex h-8 items-center gap-1 -my-2 rounded-sm focus-visible:outline-2 focus-visible:outline-primary ${buttonClassName ?? ''}`}
      >
        {label}
        <SortCaret state={state} />
      </button>
    </th>
  )
}

export function ProjectStatusTable() {
  const stats = useDashboardStats()
  const { t, locale } = useTranslation()
  const timeLocale: FormatLocale = locale === 'en' ? 'en' : 'es'
  const [sort, setSort] = useState<SortState>({ key: 'attention', dir: 'asc' })
  const [filter, setFilter] = useState('')

  const allProjects = stats.projectsByHealth.map((entry) => entry.project)
  const filtered = filterProjectsByName(allProjects, filter)
  const sorted = sortProjects(filtered, sort.key, sort.dir)
  const isFiltering = filter.trim().length > 0
  const visibleProjects = isFiltering ? sorted : sorted.slice(0, VISIBLE_LIMIT)
  const showAiColumn = reportsAiPending(allProjects)
  const title = t('dashboard.projectStatus')

  function handleSort(key: ProjectSortKey) {
    setSort((current) => nextSort(current, key))
  }

  return (
    <Card
      as="section"
      aria-labelledby={HEADING_ID}
      className="@container flex h-full flex-col overflow-hidden"
    >
      <CardHeader className="pb-4">
        <CardTitle as="h2" id={HEADING_ID}>
          {title}
        </CardTitle>
      </CardHeader>

      <div className="px-5 pb-3">
        <label htmlFor={FILTER_INPUT_ID} className="sr-only">
          {t('dashboard.filterProjects')}
        </label>
        <Input
          id={FILTER_INPUT_ID}
          type="search"
          inputMode="search"
          placeholder={t('dashboard.filterProjects')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <CardContent className="p-0 flex-1">
        <DataTable caption={title}>
          <thead>
            <tr className="border-b border-border bg-canvas/40">
              <SortableHeader
                sort={sort}
                sortKey="name"
                label={t('dashboard.thProject')}
                ariaLabel={t('dashboard.sortByProject')}
                onSort={handleSort}
                className="text-xs font-medium text-muted px-5 py-3"
              />
              <th className="text-xs font-medium text-muted px-3 py-3 @max-2xl:hidden">
                {t('dashboard.thLastRun')}
              </th>
              <SortableHeader
                sort={sort}
                sortKey="passRate"
                label={t('dashboard.thPassRate')}
                ariaLabel={t('dashboard.sortByPassRate')}
                onSort={handleSort}
                className="text-xs font-medium text-muted px-3 py-3 text-right @max-2xl:hidden"
                buttonClassName="ml-auto"
              />
              <SortableHeader
                sort={sort}
                sortKey="suites"
                label={t('dashboard.thSuites')}
                ariaLabel={t('dashboard.sortBySuites')}
                onSort={handleSort}
                className={`text-xs font-medium text-muted py-3 text-center @max-2xl:hidden ${showAiColumn ? 'px-3' : 'px-5'}`}
                buttonClassName="mx-auto"
              />
              {showAiColumn && (
                <th className="text-xs font-medium text-muted px-5 py-3 text-center @max-2xl:hidden">
                  {t('dashboard.thAiPending')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {visibleProjects.map((project) => {
              const { activity } = project
              const rowPassRateText = passRateText(activity, t)

              return (
                <tr key={project.id} className="hover:bg-canvas/20 transition-colors group">
                  <td className="px-5 py-3.5">
                    <Link
                      href={projectRootPath(project.id)}
                      className="text-xs font-semibold text-default hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
                    >
                      {project.name}
                    </Link>
                    <div
                      data-testid="project-row-metrics"
                      className="@2xl:hidden mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted tabular-nums"
                    >
                      <span>{rowPassRateText}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {project.suiteCount} {t('dashboard.thSuites').toLowerCase()}
                      </span>
                      {showAiColumn && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {activity?.aiPendingCount ?? 0} {t('dashboard.thAiPending').toLowerCase()}
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-3.5 @max-2xl:hidden">
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

                  <td className="px-3 py-3.5 text-right @max-2xl:hidden">
                    {activity && activity.healthScore !== null ? (
                      <span className="text-xs font-semibold text-default tabular-nums">
                        {rowPassRateText}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">{rowPassRateText}</span>
                    )}
                  </td>

                  <td
                    className={`py-3.5 text-xs font-medium text-default text-center tabular-nums @max-2xl:hidden ${showAiColumn ? 'px-3' : 'px-5'}`}
                  >
                    {project.suiteCount}
                  </td>

                  {showAiColumn && (
                    <td className="px-5 py-3.5 text-xs font-medium text-center tabular-nums @max-2xl:hidden">
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

      <CardFooter className="justify-between gap-3 pt-3">
        <span className="text-xs text-muted">
          {t('dashboard.showingOf', { count: visibleProjects.length, total: allProjects.length })}
        </span>
        <Link
          href="/projects"
          className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-all duration-150 shrink-0"
        >
          {t('common.viewAll')}
        </Link>
      </CardFooter>
    </Card>
  )
}
