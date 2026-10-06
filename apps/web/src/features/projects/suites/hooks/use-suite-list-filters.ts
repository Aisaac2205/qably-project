'use client'

import { useState } from 'react'
import type {
  SortKey,
  StatusFilter,
  TagFilter,
} from '@/features/projects/suites/lib/suite-filter-options'

export interface SuiteListFilters {
  search: string
  setSearch: (value: string) => void
  status: StatusFilter
  setStatus: (value: StatusFilter) => void
  tag: TagFilter
  setTag: (value: TagFilter) => void
  sort: SortKey
  setSort: (value: SortKey) => void
  hasActiveFilter: boolean
  clearFilters: () => void
}

export function useSuiteListFilters(): SuiteListFilters {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [tag, setTag] = useState<TagFilter>('all')
  const [sort, setSort] = useState<SortKey>('recent')

  const hasActiveFilter = search !== '' || status !== 'all' || tag !== 'all'

  function clearFilters() {
    setSearch('')
    setStatus('all')
    setTag('all')
  }

  return {
    search,
    setSearch,
    status,
    setStatus,
    tag,
    setTag,
    sort,
    setSort,
    hasActiveFilter,
    clearFilters,
  }
}
