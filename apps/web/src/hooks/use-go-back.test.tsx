import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGoBack } from './use-go-back'

const mockPush = vi.fn()
const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  mockPush.mockClear()
  mockBack.mockClear()
})

describe('useGoBack', () => {
  it('goes back through history when the tab has earlier entries', () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3)
    const { result } = renderHook(() => useGoBack('/projects/p1/runs'))

    result.current()

    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('pushes the fallback when the page is the first entry of the tab', () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    const { result } = renderHook(() => useGoBack('/projects/p1/runs'))

    result.current()

    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/projects/p1/runs')
  })

  it('follows the latest fallback after a rerender', () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    const { result, rerender } = renderHook(({ href }) => useGoBack(href), {
      initialProps: { href: '/projects/p1/runs' },
    })

    rerender({ href: '/projects/p1/runs/ci/c1' })
    result.current()

    expect(mockPush).toHaveBeenCalledWith('/projects/p1/runs/ci/c1')
  })
})
