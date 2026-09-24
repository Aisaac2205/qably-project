import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReviewInboxFilters } from '@/features/review-inbox/hooks/use-review-inbox-filters'

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
