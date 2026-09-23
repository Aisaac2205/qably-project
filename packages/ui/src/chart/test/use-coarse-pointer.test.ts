import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCoarsePointer } from '../use-coarse-pointer'

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  const mql = {
    get matches() {
      return matches
    },
    media: '(pointer: coarse)',
    addEventListener: (_event: 'change', listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_event: 'change', listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => mql),
  )

  return {
    setMatches(next: boolean) {
      matches = next
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent)
      }
    },
  }
}

describe('useCoarsePointer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports false when the pointer is fine (mouse/trackpad)', () => {
    mockMatchMedia(false)

    const { result } = renderHook(() => useCoarsePointer())

    expect(result.current).toBe(false)
  })

  it('reports true when the pointer is coarse (touch)', () => {
    mockMatchMedia(true)

    const { result } = renderHook(() => useCoarsePointer())

    expect(result.current).toBe(true)
  })

  it('updates when the media query changes, e.g. a hybrid device switching input', () => {
    const media = mockMatchMedia(false)

    const { result } = renderHook(() => useCoarsePointer())
    expect(result.current).toBe(false)

    act(() => {
      media.setMatches(true)
    })

    expect(result.current).toBe(true)
  })
})
