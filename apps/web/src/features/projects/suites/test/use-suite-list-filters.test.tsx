import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSuiteListFilters } from '@/features/projects/suites/hooks/use-suite-list-filters'
import { toSuiteSummariesQuery } from '@/features/projects/suites/lib/suite-summaries-query'

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

describe('useSuiteListFilters search debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderRecording() {
    const applied: string[] = []
    const rendered = renderHook(() => {
      const filters = useSuiteListFilters()
      applied.push(filters.appliedSearch)

      return filters
    })

    return { ...rendered, applied }
  }

  function distinct(values: string[]): string[] {
    return values.filter((value, index) => index === 0 || value !== values[index - 1])
  }

  it('starts with nothing applied', () => {
    const { result } = renderRecording()

    expect(result.current.search).toBe('')
    expect(result.current.appliedSearch).toBe('')
  })

  it('shows the typed text at once and applies it 300 ms after the last keystroke', () => {
    const { result, applied } = renderRecording()

    act(() => result.current.setSearch('ab'))
    act(() => vi.advanceTimersByTime(100))
    act(() => result.current.setSearch('abc'))

    expect(result.current.search).toBe('abc')
    expect(result.current.appliedSearch).toBe('')

    act(() => vi.advanceTimersByTime(299))
    expect(result.current.appliedSearch).toBe('')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.appliedSearch).toBe('abc')
    expect(distinct(applied)).toEqual(['', 'abc'])
  })

  it('applies a single keystroke after 300 ms and not before', () => {
    const { result } = renderRecording()

    act(() => result.current.setSearch('x'))
    act(() => vi.advanceTimersByTime(299))
    expect(result.current.appliedSearch).toBe('')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.appliedSearch).toBe('x')
  })

  it('applies each pause as its own search', () => {
    const { result, applied } = renderRecording()

    act(() => result.current.setSearch('login'))
    act(() => vi.advanceTimersByTime(300))
    act(() => result.current.setSearch('logout'))
    act(() => vi.advanceTimersByTime(300))

    expect(distinct(applied)).toEqual(['', 'login', 'logout'])
  })

  it('leaves the typed text alone when a status, a tag or a sort changes', () => {
    const { result } = renderRecording()
    act(() => result.current.setSearch('abc'))

    act(() => {
      result.current.setStatus('fail')
      result.current.setTag('api')
      result.current.setSort('name')
    })

    expect(result.current.search).toBe('abc')
    expect(result.current.appliedSearch).toBe('')
  })

  describe('the query the list asks for', () => {
    function queryOf(filters: ReturnType<typeof useSuiteListFilters>) {
      return toSuiteSummariesQuery({
        sort: filters.sort,
        search: filters.appliedSearch,
        status: filters.status,
        tag: filters.tag,
      })
    }

    it('carries only the sort while nothing is filtered, never an all sentinel', () => {
      const { result } = renderRecording()

      expect(queryOf(result.current)).toStrictEqual({ sort: 'recent' })
    })

    it('sends no search for text made only of spaces', () => {
      const { result } = renderRecording()

      act(() => result.current.setSearch('   '))
      act(() => vi.advanceTimersByTime(300))

      expect(result.current.appliedSearch).toBe('   ')
      expect(queryOf(result.current)).toStrictEqual({ sort: 'recent' })
    })

    it('sends the search without the spaces around it', () => {
      const { result } = renderRecording()

      act(() => result.current.setSearch('  abc '))
      act(() => vi.advanceTimersByTime(300))

      expect(queryOf(result.current)).toStrictEqual({ sort: 'recent', search: 'abc' })
    })

    it('applies a status, a tag and a sort at once, without waiting for the debounce', () => {
      const { result } = renderRecording()

      act(() => {
        result.current.setStatus('fail')
        result.current.setTag('api')
        result.current.setSort('name')
      })

      expect(queryOf(result.current)).toStrictEqual({ sort: 'name', status: 'fail', tag: 'api' })
    })

    it('drops a status and a tag again when they go back to all', () => {
      const { result } = renderRecording()
      act(() => {
        result.current.setStatus('fail')
        result.current.setTag('api')
      })

      act(() => {
        result.current.setStatus('all')
        result.current.setTag('all')
      })

      expect(queryOf(result.current)).toStrictEqual({ sort: 'recent' })
    })
  })

  describe('clearing the filters', () => {
    it('empties the typed and the applied search together without waiting', () => {
      const { result } = renderRecording()
      act(() => result.current.setSearch('checkout'))
      act(() => vi.advanceTimersByTime(300))
      expect(result.current.appliedSearch).toBe('checkout')

      act(() => result.current.clearFilters())

      expect(result.current.search).toBe('')
      expect(result.current.appliedSearch).toBe('')
    })

    it('never lets a keystroke that was still waiting land after the clear', () => {
      const { result, applied } = renderRecording()
      act(() => result.current.setSearch('abc'))
      expect(result.current.appliedSearch).toBe('')

      act(() => result.current.clearFilters())
      act(() => vi.advanceTimersByTime(1000))

      expect(result.current.search).toBe('')
      expect(distinct(applied)).toEqual([''])
    })

    it('keeps the sort order and resets the status and the tag', () => {
      const { result } = renderRecording()
      act(() => {
        result.current.setSearch('abc')
        result.current.setStatus('pass')
        result.current.setTag('smoke')
        result.current.setSort('cases')
      })
      act(() => vi.advanceTimersByTime(300))

      act(() => result.current.clearFilters())

      expect(result.current.sort).toBe('cases')
      expect(result.current.status).toBe('all')
      expect(result.current.tag).toBe('all')
    })

    it('moves the focus to the search input', () => {
      const { result } = renderRecording()
      const input = document.createElement('input')
      document.body.append(input)
      result.current.searchRef.current = input
      act(() => result.current.setSearch('abc'))

      act(() => result.current.clearFilters())

      expect(document.activeElement).toBe(input)
      input.remove()
    })

    it('does not fail when no input is attached', () => {
      const { result } = renderRecording()
      act(() => result.current.setSearch('abc'))

      expect(() => act(() => result.current.clearFilters())).not.toThrow()
      expect(result.current.search).toBe('')
    })
  })
})
