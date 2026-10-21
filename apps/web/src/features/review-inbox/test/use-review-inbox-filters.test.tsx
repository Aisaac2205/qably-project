import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReviewInboxFilters } from '@/features/review-inbox/hooks/use-review-inbox-filters'
import { reviewInboxPath } from '@/features/projects/lib/routes'

let searchParamsQuery = ''

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/review-inbox',
  useRouter: () => ({
    back: () => {},
    forward: () => {},
    prefetch: () => Promise.resolve(),
    push: () => {},
    refresh: () => {},
    replace: () => {},
  }),
  useSearchParams: () => new URLSearchParams(searchParamsQuery),
}))

describe('useReviewInboxFilters', () => {
  beforeEach(() => {
    searchParamsQuery = ''
    window.history.replaceState(null, '', '/review-inbox')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to the in_review status tab with no project and no search', () => {
    const { result } = renderHook(() => useReviewInboxFilters())

    expect(result.current.statusFilter).toBe('in_review')
    expect(result.current.selectedProjectId).toBe('all')
    expect(result.current.duplicateOnly).toBe(false)
    expect(result.current.searchQuery).toBe('')
  })

  it('reads the initial filters from the URL', () => {
    searchParamsQuery = 'projectId=proj-1&status=approved&duplicatesOnly=true&search=cart'

    const { result } = renderHook(() => useReviewInboxFilters())

    expect(result.current.selectedProjectId).toBe('proj-1')
    expect(result.current.statusFilter).toBe('approved')
    expect(result.current.duplicateOnly).toBe(true)
    expect(result.current.searchInput).toBe('cart')
    expect(result.current.searchQuery).toBe('cart')
  })

  it('opens on the project that a link built by reviewInboxPath points at', () => {
    searchParamsQuery = new URL(reviewInboxPath('proj-1'), 'http://localhost').search

    const { result } = renderHook(() => useReviewInboxFilters())

    expect(result.current.selectedProjectId).toBe('proj-1')
  })

  it('has no batch filter unless the URL names one', () => {
    const { result } = renderHook(() => useReviewInboxFilters())

    expect(result.current.batchId).toBeUndefined()
  })

  it('reads the batch from the URL next to the other filters', () => {
    searchParamsQuery = 'projectId=proj-1&batch=batch-7&status=approved'

    const { result } = renderHook(() => useReviewInboxFilters())

    expect(result.current.batchId).toBe('batch-7')
    expect(result.current.selectedProjectId).toBe('proj-1')
    expect(result.current.statusFilter).toBe('approved')
  })

  it('opens on the batch that a link built by the notification resolver points at', () => {
    searchParamsQuery = new URL('/review-inbox?projectId=proj-1&batch=a%26b', 'http://localhost')
      .search

    const { result } = renderHook(() => useReviewInboxFilters())

    expect(result.current.batchId).toBe('a&b')
  })

  it('clears the batch from the state and the URL without touching the other filters', () => {
    searchParamsQuery = 'projectId=proj-1&batch=batch-7&duplicatesOnly=true'
    window.history.replaceState(null, '', `/review-inbox?${searchParamsQuery}`)
    const { result } = renderHook(() => useReviewInboxFilters())

    act(() => {
      result.current.clearBatch()
    })

    expect(result.current.batchId).toBeUndefined()
    expect(window.location.search).not.toContain('batch')
    expect(window.location.search).toContain('projectId=proj-1')
    expect(window.location.search).toContain('duplicatesOnly=true')
    expect(result.current.selectedProjectId).toBe('proj-1')
    expect(result.current.duplicateOnly).toBe(true)
  })

  it('follows a link to another batch while the inbox is already open', () => {
    searchParamsQuery = 'projectId=proj-1&batch=batch-7'
    const { result, rerender } = renderHook(() => useReviewInboxFilters())

    searchParamsQuery = 'projectId=proj-2&batch=batch-9'
    rerender()

    expect(result.current.selectedProjectId).toBe('proj-2')
    expect(result.current.batchId).toBe('batch-9')
  })

  it('opens a linked batch on a clean queue instead of keeping the filters of the last visit', () => {
    searchParamsQuery = 'status=approved&duplicatesOnly=true&search=cart'
    const { result, rerender } = renderHook(() => useReviewInboxFilters())
    expect(result.current.searchQuery).toBe('cart')

    searchParamsQuery = 'projectId=proj-1&batch=batch-7'
    rerender()

    expect(result.current.batchId).toBe('batch-7')
    expect(result.current.statusFilter).toBe('in_review')
    expect(result.current.duplicateOnly).toBe(false)
    expect(result.current.searchInput).toBe('')
    expect(result.current.searchQuery).toBe('')
  })

  it('keeps its own change when the URL catches up with it', () => {
    const { result, rerender } = renderHook(() => useReviewInboxFilters())

    act(() => {
      result.current.setSelectedProjectId('proj-2')
    })
    act(() => {
      result.current.setSearchQuery('empty cart')
    })
    searchParamsQuery = 'projectId=proj-2'
    rerender()

    expect(result.current.selectedProjectId).toBe('proj-2')
    expect(result.current.searchInput).toBe('empty cart')
  })

  it('updates the project filter immediately and syncs the URL', () => {
    const { result } = renderHook(() => useReviewInboxFilters())

    act(() => {
      result.current.setSelectedProjectId('proj-2')
    })

    expect(result.current.selectedProjectId).toBe('proj-2')
    expect(window.location.search).toContain('projectId=proj-2')
  })

  it('debounces the search query instead of updating it on every keystroke', () => {
    const { result } = renderHook(() => useReviewInboxFilters())

    act(() => {
      result.current.setSearchQuery('empty cart')
    })

    expect(result.current.searchInput).toBe('empty cart')
    expect(result.current.searchQuery).toBe('')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.searchQuery).toBe('empty cart')
    expect(window.location.search).toContain('search=empty')
  })

  it('resets the debounce timer on every keystroke instead of firing per character', () => {
    const { result } = renderHook(() => useReviewInboxFilters())

    act(() => {
      result.current.setSearchQuery('e')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    act(() => {
      result.current.setSearchQuery('em')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current.searchQuery).toBe('')

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.searchQuery).toBe('em')
  })
})
