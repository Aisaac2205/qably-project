'use client'

/**
 * SuiteList — composes the filter bar and enriched rows for a project.
 *
 * Owns filter state (search, status, tag, sort). Renders a `SuiteFilterBar`
 * above the list of `SuiteRow` components. Two distinct empty states:
 *   1. Project has 0 suites: "No suites yet" + hint
 *   2. Filter excludes everything: "No matches" + clear-filters button
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { SuiteFilterBar, type SortKey } from './suite-filter-bar'
import { SuiteRow } from './suite-row'
import { SuiteFormDialog } from './suite-form-dialog'
import { useSuiteMetrics, type SuiteMetrics } from '@/features/projects/suites/hooks/use-suite-metrics'
import type { SuiteRunStatus } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

interface SuiteListProps {
  projectId: string
}

function applySort(items: SuiteMetrics[], sort: SortKey): SuiteMetrics[] {
  const arr = [...items]
  switch (sort) {
    case 'name':
      arr.sort((a, b) => a.suite.name.localeCompare(b.suite.name))
      break
    case 'pass-rate':
      arr.sort((a, b) => b.passRate7d - a.passRate7d)
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

function applyFilters(
  items: SuiteMetrics[],
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
  const { perSuite } = useSuiteMetrics(projectId)
  const { t } = useTranslation()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<SuiteRunStatus | 'all'>('all')
  const [tag, setTag] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [createOpen, setCreateOpen] = useState(false)

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const m of perSuite) {
      for (const tagItem of m.suite.tags) set.add(tagItem)
    }
    return Array.from(set).sort()
  }, [perSuite])

  const filtered = useMemo(
    () => applyFilters(perSuite, { search, status, tag }),
    [perSuite, search, status, tag],
  )

  const sorted = useMemo(() => applySort(filtered, sort), [filtered, sort])

  // Empty state 1: project has no suites at all
  if (perSuite.length === 0) {
    return (
      <>
        <StateView
          kind="empty"
          title={t('suites.noSuitesHeading')}
          description={t('suites.createSuiteHint')}
          action={<Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} weight="bold" aria-hidden="true" />
            {t('suites.newSuite')}
          </Button>}
        />
        <SuiteFormDialog projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />
      </>
    )
  }

  const hasActiveFilter = search !== '' || status !== 'all' || tag !== 'all'

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <SuiteFilterBar
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            tag={tag}
            onTagChange={setTag}
            sort={sort}
            onSortChange={setSort}
            availableTags={availableTags}
          />
        </div>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus size={14} weight="bold" aria-hidden="true" />
          {t('suites.newSuite')}
        </Button>
      </div>

      {sorted.length === 0 ? (
        // Empty state 2: filter excludes everything
        <StateView
          kind="empty"
          title={t('suites.noSuitesMatch')}
          action={hasActiveFilter ? (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatus('all')
                setTag('all')
              }}
              className="text-sm text-default font-medium hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('suites.clearFilters')}
            </button>
          ) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <EntityList aria-label={t('suites.ariaFilterSuites')}>
            {sorted.map((m) => (
              <li key={m.suite.id}>
                <Link
                  href={`/projects/${projectId}/suites/${m.suite.id}`}
                  className="block focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <SuiteRow suite={m.suite} metrics={m} />
                </Link>
              </li>
            ))}
            </EntityList>
          </CardContent>
        </Card>
      )}

      <SuiteFormDialog projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
