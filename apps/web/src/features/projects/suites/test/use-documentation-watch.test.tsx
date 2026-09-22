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

    expect(result.current.statusFor(true)).toBe('idle')
    expect(result.current.intervalFor(true)).toBe(false)
  })

  it('polls while the accepted run is still documenting', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))

    expect(result.current.statusFor(true)).toBe('working')
    expect(result.current.intervalFor(true)).toBe(DOCUMENTATION_POLL_INTERVAL_MS)
  })

  it('does not settle on the very first read right after begin(), before any poll confirms it', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))

    expect(result.current.statusFor(false)).toBe('working')
    expect(result.current.intervalFor(false)).toBe(DOCUMENTATION_POLL_INTERVAL_MS)
  })

  it('stops polling once a poll observes the run finished after having been busy', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))
    act(() => result.current.observe(true))
    act(() => result.current.observe(false))

    expect(result.current.intervalFor(false)).toBe(false)
    expect(result.current.statusFor(false)).toBe('settled')
  })

  it('settles after the grace of consecutive not-busy polls when busy was never observed', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))
    act(() => result.current.observe(false))
    expect(result.current.statusFor(false)).toBe('working')

    act(() => result.current.observe(false))
    expect(result.current.statusFor(false)).toBe('settled')
  })

  it('admits it cannot tell a slow job from a failed one once the window elapses', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))
    act(() => {
      vi.advanceTimersByTime(WINDOW_MS)
    })

    expect(result.current.statusFor(true)).toBe('timed-out')
    expect(result.current.intervalFor(true)).toBe(false)
  })

  it('returns to idle when the reader dismisses the outcome', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))
    act(() => result.current.dismiss())

    expect(result.current.statusFor(true)).toBe('idle')
  })

  it('restarts the window when a second run is accepted', () => {
    const { result } = renderHook(() => useDocumentationWatch(WINDOW_MS))

    act(() => result.current.begin(7))
    act(() => {
      vi.advanceTimersByTime(WINDOW_MS)
    })
    expect(result.current.statusFor(true)).toBe('timed-out')

    act(() => result.current.begin(7))

    expect(result.current.statusFor(true)).toBe('working')
  })
})
