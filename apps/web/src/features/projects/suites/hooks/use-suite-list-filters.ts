'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import type {
  SortKey,
  StatusFilter,
  TagFilter,
} from '@/features/projects/suites/lib/suite-filter-options'

const SEARCH_DEBOUNCE_MS = 300

export interface SuiteListFilters {
  search: string
  appliedSearch: string
  setSearch: (value: string) => void
  setSearchComposing: (composing: boolean) => void
  searchRef: RefObject<HTMLInputElement | null>
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
  const [appliedSearch, setAppliedSearch] = useState('')
  const [isComposing, setSearchComposing] = useState(false)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [tag, setTag] = useState<TagFilter>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isComposing) return

    const timer = setTimeout(() => setAppliedSearch(search), SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [search, isComposing])

  const hasActiveFilter = search !== '' || status !== 'all' || tag !== 'all'

  function clearFilters() {
    setSearch('')
    setAppliedSearch('')
    setSearchComposing(false)
    setStatus('all')
    setTag('all')
    searchRef.current?.focus()
  }

  return {
    search,
    appliedSearch,
    setSearch,
    setSearchComposing,
    searchRef,
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
