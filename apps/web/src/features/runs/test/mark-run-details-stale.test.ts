import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { runKeys } from '../lib/query-keys'
import { markRunDetailsStale } from '../lib/mark-run-details-stale'

function seededClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  client.setQueryData(runKeys.detail('run-1'), { id: 'run-1' })
  client.setQueryData(runKeys.detail('run-2'), { id: 'run-2' })
  client.setQueryData(runKeys.list('proj-1'), { items: [] })
  client.setQueryData(runKeys.page('proj-1', 'all'), { pages: [], pageParams: [] })
  client.setQueryData(runKeys.suiteMetrics('proj-1'), { items: [] })
  return client
}

describe('runKeys.detail', () => {
  it('lives under the shared detail prefix so every run detail can be addressed at once', () => {
    expect(runKeys.details).toEqual(['runs', 'detail'])
    expect(runKeys.detail('run-1').slice(0, 2)).toEqual(runKeys.details)
    expect(runKeys.detail('run-1').slice(0, 1)).toEqual(runKeys.all)
  })

  it('never collides with the other run keys', () => {
    expect(runKeys.list('proj-1').slice(0, 2)).not.toEqual(runKeys.details)
    expect(runKeys.page('proj-1', 'all').slice(0, 2)).not.toEqual(runKeys.details)
    expect(runKeys.suiteMetrics('proj-1').slice(0, 2)).not.toEqual(runKeys.details)
  })
})

describe('markRunDetailsStale', () => {
  it('marks every cached run detail stale', () => {
    const client = seededClient()

    markRunDetailsStale(client)

    expect(client.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(runKeys.detail('run-2'))?.isInvalidated).toBe(true)
  })

  it('leaves the run lists, pages and metrics alone', () => {
    const client = seededClient()

    markRunDetailsStale(client)

    expect(client.getQueryState(runKeys.list('proj-1'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(runKeys.page('proj-1', 'all'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(runKeys.suiteMetrics('proj-1'))?.isInvalidated).toBe(false)
  })

  it('never fetches, so a mutation costs no request even for a run detail that still has an observer', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue({ id: 'run-1' })
    const observer = new QueryObserver(client, {
      queryKey: runKeys.detail('run-1'),
      queryFn,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    markRunDetailsStale(client)
    await client.isFetching()
    unsubscribe()

    expect(queryFn).not.toHaveBeenCalled()
    expect(client.getQueryData(runKeys.detail('run-1'))).toEqual({ id: 'run-1' })
  })

  it('makes the next visit to the run refetch its detail even inside the stale time', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue({ id: 'run-1' })

    markRunDetailsStale(client)
    const observer = new QueryObserver(client, {
      queryKey: runKeys.detail('run-1'),
      queryFn,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1))
    unsubscribe()
  })
})
