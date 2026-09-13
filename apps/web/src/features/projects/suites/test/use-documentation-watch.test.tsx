import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocumentationWatch } from '@/features/projects/suites/hooks/use-documentation-watch'
import { DOCUMENTATION_POLL_INTERVAL_MS } from '@/features/projects/suites/lib/documentation-watch'

const WINDOW_MS = 10_000

describe('useDocumentationWatch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not poll before a documentation run is accepted', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    expect(result.current.statusFor(7)).toBe('idle')
    expect(result.current.intervalFor(7)).toBe(false)
  })

  it('polls while the accepted run has not moved the count', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))

    expect(result.current.statusFor(7)).toBe('working')
    expect(result.current.intervalFor(7)).toBe(DOCUMENTATION_POLL_INTERVAL_MS)
  })

  it('stops polling the moment the query itself sees the count drop', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))

    expect(result.current.intervalFor(2)).toBe(false)
    expect(result.current.statusFor(2)).toBe('settled')
  })

  it('admits it cannot tell a slow job from a failed one once the window elapses', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))
    act(() => {
      vi.advanceTimersByTime(WINDOW_MS)
    })

    expect(result.current.statusFor(7)).toBe('timed-out')
    expect(result.current.intervalFor(7)).toBe(false)
  })

  it('returns to idle when the reader dismisses the outcome', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))
    act(() => result.current.dismiss())

    expect(result.current.statusFor(7)).toBe('idle')
  })

  it('restarts the window when a second run is accepted', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))
    act(() => {
      vi.advanceTimersByTime(WINDOW_MS)
    })
    expect(result.current.statusFor(7)).toBe('timed-out')

    act(() => result.current.begin(7))

    expect(result.current.statusFor(7)).toBe('working')
  })
})
