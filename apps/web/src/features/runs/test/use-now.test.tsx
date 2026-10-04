import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from '@/features/runs/hooks/use-now'

const START = new Date('2026-10-03T12:00:00.000Z')

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: START, toFake: ['Date', 'setInterval', 'clearInterval'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at the current time', () => {
    const { result } = renderHook(() => useNow(10_000))

    expect(result.current).toBe(START.getTime())
  })

  it('moves to the current time once per interval and not before', () => {
    const { result } = renderHook(() => useNow(10_000))

    act(() => {
      vi.advanceTimersByTime(9_999)
    })
    expect(result.current).toBe(START.getTime())

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(START.getTime() + 10_000)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current).toBe(START.getTime() + 20_000)
  })

  it('keeps a single timer alive while mounted and none after unmount', () => {
    const { unmount } = renderHook(() => useNow(10_000))

    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('restarts the timer with the new cadence when the interval changes', () => {
    const { result, rerender } = renderHook(({ every }) => useNow(every), {
      initialProps: { every: 10_000 },
    })

    rerender({ every: 1_000 })
    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(result.current).toBe(START.getTime() + 1_000)
    expect(vi.getTimerCount()).toBe(1)
  })
})
