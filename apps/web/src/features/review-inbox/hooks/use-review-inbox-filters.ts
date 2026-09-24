'use client'

import { useMemo, useState } from 'react'
import type { ReviewQueueStatusFilter } from '../components/review-inbox-queue'

export interface UseReviewInboxFiltersResult {
  selectedProjectId: string
  setSelectedProjectId: (id: string) => void
  statusFilter: ReviewQueueStatusFilter
  setStatusFilter: (status: ReviewQueueStatusFilter) => void
  duplicateOnly: boolean
  setDuplicateOnly: (value: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export function useReviewInboxFilters(): UseReviewInboxFiltersResult {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<ReviewQueueStatusFilter>('in_review')
  const [duplicateOnly, setDuplicateOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  return useMemo(
    () => ({
      selectedProjectId,
      setSelectedProjectId,
      statusFilter,
      setStatusFilter,
      duplicateOnly,
      setDuplicateOnly,
      searchQuery,
      setSearchQuery,
    }),
    [selectedProjectId, statusFilter, duplicateOnly, searchQuery],
  )
}
