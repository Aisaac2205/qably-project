import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const mockParams = vi.fn<() => Record<string, string | string[] | undefined>>(() => ({}))

vi.mock('next/navigation', () => ({
  useParams: () => mockParams(),
}))

import { useProjectRouteId } from '@/features/projects/hooks/use-project-route-id'

describe('useProjectRouteId', () => {
  it('returns the id the router filled in for a dynamic project route', () => {
    mockParams.mockReturnValue({ id: 'proj-1' })

    const { result } = renderHook(() => useProjectRouteId())

    expect(result.current).toBe('proj-1')
  })

  it('returns null on a static sibling route such as /projects/new', () => {
    mockParams.mockReturnValue({})

    const { result } = renderHook(() => useProjectRouteId())

    expect(result.current).toBeNull()
  })

  it('returns null when the segment resolves to an array', () => {
    mockParams.mockReturnValue({ id: ['proj-1', 'runs'] })

    const { result } = renderHook(() => useProjectRouteId())

    expect(result.current).toBeNull()
  })

  it('returns null when the segment is empty', () => {
    mockParams.mockReturnValue({ id: '' })

    const { result } = renderHook(() => useProjectRouteId())

    expect(result.current).toBeNull()
  })
})
