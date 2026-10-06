'use client'

import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { buttonVariants } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { suiteNewPath } from '@/features/projects/lib/routes'
import type { SuiteListFilters } from '@/features/projects/suites/hooks/use-suite-list-filters'
import { SuiteFilterBar } from './suite-filter-bar'
import { SuiteFiltersSheet } from './suite-filters-sheet'

interface SuiteListToolbarProps {
  projectId: string
  filters: SuiteListFilters
  availableTags: string[]
}

export function SuiteListToolbar({ projectId, filters, availableTags }: SuiteListToolbarProps) {
  const { t } = useTranslation()
  const {
    search,
    setSearch,
    setSearchComposing,
    searchRef,
    status,
    setStatus,
    tag,
    setTag,
    sort,
    setSort,
  } = filters

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
      <SuiteFilterBar
        className="md:min-w-0 md:flex-1"
        search={search}
        onSearchChange={setSearch}
        onSearchCompositionChange={setSearchComposing}
        searchRef={searchRef}
        status={status}
        onStatusChange={setStatus}
        tag={tag}
        onTagChange={setTag}
        sort={sort}
        onSortChange={setSort}
        availableTags={availableTags}
      />
      <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
        <Link href={suiteNewPath(projectId)} className={cn(buttonVariants(), 'w-full md:w-auto')}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          {t('suites.newSuite')}
        </Link>
        <SuiteFiltersSheet
          className="md:hidden"
          status={status}
          onStatusChange={setStatus}
          tag={tag}
          onTagChange={setTag}
          sort={sort}
          onSortChange={setSort}
          availableTags={availableTags}
        />
      </div>
    </div>
  )
}
