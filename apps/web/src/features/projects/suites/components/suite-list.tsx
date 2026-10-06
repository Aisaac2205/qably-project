'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { buttonVariants } from '@/components/ui/button'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { SuiteListToolbar } from './suite-list-toolbar'
import { SuiteRow } from './suite-row'
import { useSuiteMetrics, type SuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'
import { useSuiteListFilters } from '@/features/projects/suites/hooks/use-suite-list-filters'
import type { SortKey } from '@/features/projects/suites/lib/suite-filter-options'
import type { SuiteRunStatus } from '@qably/types'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { suiteNewPath } from '@/features/projects/lib/routes'

interface SuiteListProps {
  projectId: string
}

function applySort<T extends SuiteMetrics>(items: T[], sort: SortKey): T[] {
  const arr = [...items]
  switch (sort) {
    case 'name':
      arr.sort((a, b) => a.suite.name.localeCompare(b.suite.name))
      break
    case 'pass-rate':
      arr.sort((a, b) => (b.recentPassRate ?? -1) - (a.recentPassRate ?? -1))
      break
    case 'cases':
      arr.sort((a, b) => b.suite.cases.length - a.suite.cases.length)
      break
    case 'recent':
    default:
      arr.sort(
        (a, b) =>
          new Date(b.suite.createdAt).getTime() - new Date(a.suite.createdAt).getTime(),
      )
      break
  }
  return arr
}

function applyFilters<T extends SuiteMetrics>(
  items: T[],
  filters: {
    search: string
    status: SuiteRunStatus | 'all'
    tag: string | 'all'
  },
) {
  const q = filters.search.trim().toLowerCase()
  return items.filter((m) => {
    if (q) {
      const hay = `${m.suite.name} ${m.suite.description}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.status !== 'all' && m.status !== filters.status) return false
    if (filters.tag !== 'all' && !m.suite.tags.includes(filters.tag)) return false
    return true
  })
}

export function SuiteList({ projectId }: SuiteListProps) {
  const { t } = useTranslation()
  const { perSuite, isLoading, isError } = useSuiteMetrics(projectId)
  const filters = useSuiteListFilters()
  const { search, status, tag, sort, hasActiveFilter, clearFilters } = filters

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const m of perSuite) {
      for (const tagItem of m.suite.tags) set.add(tagItem)
    }
    return Array.from(set).sort()
  }, [perSuite])

  const rows = useMemo(
    () => perSuite.map((m) => ({ ...m, row: { ...m.suite, status: m.status } })),
    [perSuite],
  )

  const filtered = useMemo(
    () => applyFilters(rows, { search, status, tag }),
    [rows, search, status, tag],
  )

  const sorted = useMemo(() => applySort(filtered, sort), [filtered, sort])

  if (isLoading) {
    return <StateView kind="loading" title={t('common.loading')} />
  }

  if (isError) {
    return <StateView kind="error" title={t('suites.loadError')} focusOnMount />
  }

  if (perSuite.length === 0) {
    return (
      <StateView
        kind="empty"
        title={t('suites.noSuitesHeading')}
        description={t('suites.createSuiteHint')}
        action={
          <Link href={suiteNewPath(projectId)} className={cn(buttonVariants({ size: 'sm' }))}>
            <Plus size={14} weight="bold" aria-hidden="true" />
            {t('suites.newSuite')}
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      <SuiteListToolbar projectId={projectId} filters={filters} availableTags={availableTags} />

      {sorted.length === 0 ? (
        <StateView
          kind="empty"
          title={t('suites.noSuitesMatch')}
          action={hasActiveFilter ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-default font-medium hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('suites.clearFilters')}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="rule-bleed border-y border-border">
          <EntityList aria-label={t('suites.ariaFilterSuites')} className="divide-y divide-border">
            {sorted.map((m) => (
              <li key={m.suite.id}>
                <Link
                  href={`/projects/${projectId}/suites/${m.suite.id}`}
                  className="block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <SuiteRow suite={m.row} />
                </Link>
              </li>
            ))}
          </EntityList>
        </div>
      )}
    </div>
  )
}
