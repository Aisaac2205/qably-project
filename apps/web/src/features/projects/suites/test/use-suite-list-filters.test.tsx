import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSuiteListFilters } from '@/features/projects/suites/hooks/use-suite-list-filters'

describe('useSuiteListFilters', () => {
  it('starts with no search, every status, every tag and the most recent first, with no active filter', () => {
    const { result } = renderHook(() => useSuiteListFilters())

    expect(result.current.search).toBe('')
    expect(result.current.status).toBe('all')
    expect(result.current.tag).toBe('all')
    expect(result.current.sort).toBe('recent')
    expect(result.current.hasActiveFilter).toBe(false)
  })

  it('stores what each setter receives and leaves the other values alone', () => {
    const { result } = renderHook(() => useSuiteListFilters())

    act(() => result.current.setSearch('checkout'))
    act(() => result.current.setStatus('fail'))
    act(() => result.current.setTag('api'))
    act(() => result.current.setSort('cases'))

    expect(result.current.search).toBe('checkout')
    expect(result.current.status).toBe('fail')
    expect(result.current.tag).toBe('api')
    expect(result.current.sort).toBe('cases')
  })

  it.each([
    ['a search', (filters: ReturnType<typeof useSuiteListFilters>) => filters.setSearch('login')],
    ['a status', (filters: ReturnType<typeof useSuiteListFilters>) => filters.setStatus('pass')],
    ['a tag', (filters: ReturnType<typeof useSuiteListFilters>) => filters.setTag('smoke')],
  ])('reports an active filter once %s is set', (_label, apply) => {
    const { result } = renderHook(() => useSuiteListFilters())

    act(() => apply(result.current))

    expect(result.current.hasActiveFilter).toBe(true)
  })

  it('does not count the sort order as an active filter', () => {
    const { result } = renderHook(() => useSuiteListFilters())

    act(() => result.current.setSort('name'))

    expect(result.current.sort).toBe('name')
    expect(result.current.hasActiveFilter).toBe(false)
  })

  it('clears the search, the status and the tag together and keeps the sort order', () => {
    const { result } = renderHook(() => useSuiteListFilters())
    act(() => {
      result.current.setSearch('login')
      result.current.setStatus('needs-attention')
      result.current.setTag('smoke')
      result.current.setSort('pass-rate')
    })
    expect(result.current.hasActiveFilter).toBe(true)

    act(() => result.current.clearFilters())

    expect(result.current.search).toBe('')
    expect(result.current.status).toBe('all')
    expect(result.current.tag).toBe('all')
    expect(result.current.sort).toBe('pass-rate')
    expect(result.current.hasActiveFilter).toBe(false)
  })

  it('clears a single active filter without needing the others to be set', () => {
    const { result } = renderHook(() => useSuiteListFilters())
    act(() => result.current.setStatus('running'))

    act(() => result.current.clearFilters())

    expect(result.current.status).toBe('all')
    expect(result.current.hasActiveFilter).toBe(false)
  })
})
