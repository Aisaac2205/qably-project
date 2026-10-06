import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SuiteTagsFacet } from '@qably/types'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import { useSuiteTags } from '@/features/projects/suites/hooks/use-suite-summaries'
import { listSuiteTags } from '@/features/projects/suites/api/suites.api'
import { createTestQueryClient } from '@/lib/query-test-utils'
import { createQueryClient, deferred, wrapperFor } from './suite-summaries-test-data'

vi.mock('@/features/projects/suites/api/suites.api', () => ({
  listSuiteSummaries: vi.fn(),
  listSuiteTags: vi.fn(),
}))

const listTags = vi.mocked(listSuiteTags)

beforeEach(() => {
  listTags.mockReset()
})

describe('useSuiteTags', () => {
  it('asks for the facet of the project and exposes its tags in the order received', async () => {
    listTags.mockResolvedValue({ items: ['C', 'a', 'b'] })

    const { result } = renderHook(() => useSuiteTags('proj-1'), {
      wrapper: wrapperFor(createQueryClient()),
    })

    await waitFor(() => expect(result.current.tags).toEqual(['C', 'a', 'b']))
    expect(listTags).toHaveBeenCalledTimes(1)
    expect(listTags).toHaveBeenCalledWith('proj-1', expect.any(AbortSignal))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('offers no tags while the facet is loading', () => {
    const facet = deferred<SuiteTagsFacet>()
    listTags.mockReturnValue(facet.promise)

    const { result } = renderHook(() => useSuiteTags('proj-1'), {
      wrapper: wrapperFor(createQueryClient()),
    })

    expect(result.current.tags).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it('offers no tags and reports the failure when the facet fails', async () => {
    listTags.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useSuiteTags('proj-1'), {
      wrapper: wrapperFor(createQueryClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.tags).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('keeps one facet per project', async () => {
    listTags.mockImplementation((projectId) =>
      Promise.resolve({ items: [`tag-of-${projectId}`] }),
    )

    const { result, rerender } = renderHook(({ projectId }) => useSuiteTags(projectId), {
      wrapper: wrapperFor(createQueryClient()),
      initialProps: { projectId: 'proj-1' },
    })
    await waitFor(() => expect(result.current.tags).toEqual(['tag-of-proj-1']))

    rerender({ projectId: 'proj-2' })

    await waitFor(() => expect(result.current.tags).toEqual(['tag-of-proj-2']))
    expect(listTags).toHaveBeenCalledTimes(2)
  })

  it('reads the seeded facet on the first render, before any request settles', () => {
    listTags.mockReturnValue(new Promise(() => undefined))

    const { result } = renderHook(() => useSuiteTags('proj-1'), {
      wrapper: wrapperFor(createTestQueryClient()),
    })

    expect(result.current.tags).toEqual([
      'account',
      'auth',
      'checkout',
      'e2e',
      'payments',
      'profile',
      'regression',
      'security',
      'smoke',
    ])
    expect(result.current.isLoading).toBe(false)
  })

  it('defines no refetch interval on the query it observes', async () => {
    listTags.mockResolvedValue({ items: ['a'] })
    const client = createQueryClient()

    const { result } = renderHook(() => useSuiteTags('proj-1'), { wrapper: wrapperFor(client) })
    await waitFor(() => expect(result.current.tags).toEqual(['a']))

    const observed = client.getQueryCache().findAll({ queryKey: suiteKeys.tags('proj-1') })

    expect(observed).toHaveLength(1)
    expect(observed[0]?.observers).toHaveLength(1)
    expect(observed[0]?.observers[0]?.options.refetchInterval).toBeUndefined()
  })
})
