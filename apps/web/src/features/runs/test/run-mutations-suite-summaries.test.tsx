import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider, QueryObserver, type QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import {
  LOOKALIKE_PROJECT,
  OTHER_PROJECT,
  RECENT,
  SEARCH,
  dataOf,
  seededClient,
} from '@/features/projects/suites/test/suite-summaries-cache-test-data'
import { summary } from '@/features/projects/suites/test/suite-summaries-test-data'
import { useCreateRun } from '@/features/runs/hooks/use-create-run'
import { useUpdateRunCase } from '@/features/runs/hooks/use-update-run-case'

vi.mock('@/features/runs/api/runs.api', async () => await import('@/test/runs-api-stub'))

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}))

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function isInvalidated(client: QueryClient, key: readonly unknown[]): boolean | undefined {
  return client.getQueryState(key)?.isInvalidated
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCreateRun and the paged suite summaries', () => {
  async function startRunIn(client: QueryClient, projectId: string) {
    const { result } = renderHook(() => useCreateRun(projectId), { wrapper: wrapperFor(client) })

    result.current.start('suite-1')

    await waitFor(() => expect(navigation.push).toHaveBeenCalledTimes(1))
  }

  it('invalidates every summary variant of the project once the run exists', async () => {
    const client = seededClient()

    await startRunIn(client, 'proj-1')

    expect(isInvalidated(client, RECENT)).toBe(true)
    expect(isInvalidated(client, SEARCH)).toBe(true)
  })

  it('leaves the summaries of other projects alone', async () => {
    const client = seededClient()

    await startRunIn(client, 'proj-1')

    expect(isInvalidated(client, OTHER_PROJECT)).toBe(false)
    expect(isInvalidated(client, LOOKALIKE_PROJECT)).toBe(false)
  })

  it('invalidates the project the run was started for, not a fixed one', async () => {
    const client = seededClient()

    await startRunIn(client, 'proj-2')

    expect(isInvalidated(client, OTHER_PROJECT)).toBe(true)
    expect(isInvalidated(client, RECENT)).toBe(false)
  })

  it('refetches the summaries that someone is looking at', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue(dataOf([summary('a')]))
    const observer = new QueryObserver(client, { queryKey: RECENT, queryFn })
    const unsubscribe = observer.subscribe(() => undefined)

    await startRunIn(client, 'proj-1')
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1))
    unsubscribe()
  })
})

describe('useUpdateRunCase and the paged suite summaries', () => {
  async function recordCaseResultIn(client: QueryClient) {
    const { result } = renderHook(() => useUpdateRunCase('run-12'), {
      wrapper: wrapperFor(client),
    })

    result.current('tc-1', 'fail')

    await waitFor(() => expect(isInvalidated(client, RECENT)).toBe(true))
  }

  it('marks every summary variant of the run project stale', async () => {
    const client = seededClient()

    await recordCaseResultIn(client)

    expect(isInvalidated(client, RECENT)).toBe(true)
    expect(isInvalidated(client, SEARCH)).toBe(true)
  })

  it('leaves the tag facet and the summaries of other projects alone', async () => {
    const client = seededClient()

    await recordCaseResultIn(client)

    expect(isInvalidated(client, suiteKeys.tags('proj-1'))).toBe(false)
    expect(isInvalidated(client, OTHER_PROJECT)).toBe(false)
    expect(isInvalidated(client, LOOKALIKE_PROJECT)).toBe(false)
  })

  it('never fetches, so recording a case result costs no request for a list still on screen', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue(dataOf([summary('a')]))
    const observer = new QueryObserver(client, { queryKey: RECENT, queryFn })
    const unsubscribe = observer.subscribe(() => undefined)

    await recordCaseResultIn(client)
    await client.isFetching()
    unsubscribe()

    expect(queryFn).not.toHaveBeenCalled()
  })
})
