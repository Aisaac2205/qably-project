'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ReviewQueueStatusFilter } from '../components/review-inbox-queue'

const SEARCH_DEBOUNCE_MS = 300

export interface UseReviewInboxFiltersResult {
  selectedProjectId: string
  setSelectedProjectId: (id: string) => void
  /** The batch of proposals the queue is narrowed to, when a link named one. */
  batchId: string | undefined
  clearBatch: () => void
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

function readStatus(value: string | null): ReviewQueueStatusFilter {
  return isStatusFilter(value) ? value : 'in_review'
}

function readBatch(value: string | null): string | undefined {
  return value === null || value === '' ? undefined : value
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

  const urlProjectId = searchParams.get('projectId') ?? 'all'
  const urlBatchId = readBatch(searchParams.get('batch'))
  const urlStatus = readStatus(searchParams.get('status'))
  const urlDuplicateOnly = searchParams.get('duplicatesOnly') === 'true'
  const urlSearch = searchParams.get('search') ?? ''

  const [selectedProjectId, setSelectedProjectIdState] = useState(urlProjectId)
  const [batchId, setBatchIdState] = useState(urlBatchId)
  const [statusFilter, setStatusFilterState] = useState<ReviewQueueStatusFilter>(urlStatus)
  const [duplicateOnly, setDuplicateOnlyState] = useState(urlDuplicateOnly)
  const [searchInput, setSearchInput] = useState(urlSearch)
  const [searchQuery, setSearchQueryState] = useState(urlSearch)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // A link to the inbox (a notification, a toast) can arrive while this page is
  // already mounted, and Next then keeps the component and only swaps the query
  // string. The setters below write state and URL together, so a URL that still
  // matches the state is just our own write catching up and is ignored; one that
  // differs came from outside and opens the queue as the link describes it.
  const urlSignature = [urlProjectId, urlBatchId ?? '', urlStatus, urlDuplicateOnly].join('|')
  const [appliedSignature, setAppliedSignature] = useState(urlSignature)
  if (urlSignature !== appliedSignature) {
    setAppliedSignature(urlSignature)
    const followsUrl =
      selectedProjectId === urlProjectId &&
      batchId === urlBatchId &&
      statusFilter === urlStatus &&
      duplicateOnly === urlDuplicateOnly
    if (!followsUrl) {
      setSelectedProjectIdState(urlProjectId)
      setBatchIdState(urlBatchId)
      setStatusFilterState(urlStatus)
      setDuplicateOnlyState(urlDuplicateOnly)
      setSearchInput(urlSearch)
      setSearchQueryState(urlSearch)
    }
  }

  const setSelectedProjectId = useCallback((id: string) => {
    setSelectedProjectIdState(id)
    syncUrl({ projectId: id === 'all' ? undefined : id })
  }, [])

  const clearBatch = useCallback(() => {
    setBatchIdState(undefined)
    syncUrl({ batch: undefined })
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
      batchId,
      clearBatch,
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
      batchId,
      clearBatch,
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
