'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ReviewQueueStatusFilter } from '../components/review-inbox-queue'

const SEARCH_DEBOUNCE_MS = 300

export interface UseReviewInboxFiltersResult {
  selectedProjectId: string
  setSelectedProjectId: (id: string) => void
  statusFilter: ReviewQueueStatusFilter
  setStatusFilter: (status: ReviewQueueStatusFilter) => void
  duplicateOnly: boolean
  setDuplicateOnly: (value: boolean) => void
  searchInput: string
  searchQuery: string
  setSearchQuery: (query: string) => void
}

function isStatusFilter(value: string | null): value is ReviewQueueStatusFilter {
  return value === 'in_review' || value === 'all' || value === 'approved' || value === 'rejected'
}

function syncUrl(entries: Record<string, string | undefined>): void {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === '') params.delete(key)
    else params.set(key, value)
  }

  const query = params.toString()
  window.history.replaceState(
    null,
    '',
    query === '' ? window.location.pathname : `${window.location.pathname}?${query}`,
  )
}

export function useReviewInboxFilters(): UseReviewInboxFiltersResult {
  const searchParams = useSearchParams()

  const [selectedProjectId, setSelectedProjectIdState] = useState(
    () => searchParams.get('projectId') ?? 'all',
  )
  const [statusFilter, setStatusFilterState] = useState<ReviewQueueStatusFilter>(() => {
    const status = searchParams.get('status')
    return isStatusFilter(status) ? status : 'in_review'
  })
  const [duplicateOnly, setDuplicateOnlyState] = useState(
    () => searchParams.get('duplicatesOnly') === 'true',
  )
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') ?? '')
  const [searchQuery, setSearchQueryState] = useState(() => searchParams.get('search') ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const setSelectedProjectId = useCallback((id: string) => {
    setSelectedProjectIdState(id)
    syncUrl({ projectId: id === 'all' ? undefined : id })
  }, [])

  const setStatusFilter = useCallback((status: ReviewQueueStatusFilter) => {
    setStatusFilterState(status)
    syncUrl({ status: status === 'in_review' ? undefined : status })
  }, [])

  const setDuplicateOnly = useCallback((value: boolean) => {
    setDuplicateOnlyState(value)
    syncUrl({ duplicatesOnly: value ? 'true' : undefined })
  }, [])

  const setSearchQuery = useCallback((query: string) => {
    setSearchInput(query)
  }, [])

  useEffect(() => {
    if (debounceRef.current !== undefined) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      setSearchQueryState(searchInput)
      syncUrl({ search: searchInput.trim() === '' ? undefined : searchInput })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current !== undefined) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  return useMemo(
    () => ({
      selectedProjectId,
      setSelectedProjectId,
      statusFilter,
      setStatusFilter,
      duplicateOnly,
      setDuplicateOnly,
      searchInput,
      searchQuery,
      setSearchQuery,
    }),
    [
      selectedProjectId,
      setSelectedProjectId,
      statusFilter,
      setStatusFilter,
      duplicateOnly,
      setDuplicateOnly,
      searchInput,
      searchQuery,
      setSearchQuery,
    ],
  )
}
