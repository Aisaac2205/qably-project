import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { ciRunKeys, runKeys } from '../lib/query-keys'
import { markCiRunsStale } from '../lib/mark-ci-runs-stale'

function seededClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  client.setQueryData(ciRunKeys.page('proj-1'), { pages: [], pageParams: [] })
  client.setQueryData(ciRunKeys.page('proj-2'), { pages: [], pageParams: [] })
  client.setQueryData(ciRunKeys.page('proj-10'), { pages: [], pageParams: [] })
  client.setQueryData(ciRunKeys.detail('ci-1'), { id: 'ci-1', runs: [] })
  client.setQueryData(ciRunKeys.detail('ci-2'), { id: 'ci-2', runs: [] })
  client.setQueryData(runKeys.detail('run-1'), { id: 'run-1' })
  client.setQueryData(runKeys.page('proj-1', 'all'), { pages: [], pageParams: [] })
  client.setQueryData(runKeys.regressions('proj-1', 20), { items: [], runsScanned: 0 })
  return client
}

describe('ciRunKeys.details', () => {
  it('is the prefix of every CI run detail key so all of them can be addressed at once', () => {
    expect(ciRunKeys.details).toEqual(['ci-runs', 'detail'])
    expect(ciRunKeys.detail('ci-1').slice(0, 2)).toEqual(ciRunKeys.details)
    expect(ciRunKeys.detail('ci-1').slice(0, 1)).toEqual(ciRunKeys.all)
  })

  it('never collides with the CI run page keys', () => {
    expect(ciRunKeys.page('proj-1').slice(0, 2)).not.toEqual(ciRunKeys.details)
  })
})

describe('markCiRunsStale', () => {
  it('marks every cached CI run detail stale', () => {
    const client = seededClient()

    markCiRunsStale(client, 'proj-1')

    expect(client.getQueryState(ciRunKeys.detail('ci-1'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(ciRunKeys.detail('ci-2'))?.isInvalidated).toBe(true)
  })

  it('marks the CI run list of the project stale', () => {
    const client = seededClient()

    markCiRunsStale(client, 'proj-1')

    expect(client.getQueryState(ciRunKeys.page('proj-1'))?.isInvalidated).toBe(true)
  })

  it('leaves the CI run lists of other projects alone, even when their id starts with the same text', () => {
    const client = seededClient()

    markCiRunsStale(client, 'proj-1')

    expect(client.getQueryState(ciRunKeys.page('proj-2'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(ciRunKeys.page('proj-10'))?.isInvalidated).toBe(false)
  })

  it('leaves the run details, the run pages and the regressions alone', () => {
    const client = seededClient()

    markCiRunsStale(client, 'proj-1')

    expect(client.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(runKeys.page('proj-1', 'all'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(runKeys.regressions('proj-1', 20))?.isInvalidated).toBe(false)
  })

  it('never fetches, so a mutation costs no request even for a CI run that still has an observer', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue({ id: 'ci-1', runs: [] })
    const observer = new QueryObserver(client, {
      queryKey: ciRunKeys.detail('ci-1'),
      queryFn,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    markCiRunsStale(client, 'proj-1')
    await client.isFetching()
    unsubscribe()

    expect(queryFn).not.toHaveBeenCalled()
    expect(client.getQueryData(ciRunKeys.detail('ci-1'))).toEqual({ id: 'ci-1', runs: [] })
  })

  it('makes the next visit to a CI run refetch its detail even inside the stale time', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue({ id: 'ci-1', runs: [] })

    markCiRunsStale(client, 'proj-1')
    const observer = new QueryObserver(client, {
      queryKey: ciRunKeys.detail('ci-1'),
      queryFn,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1))
    unsubscribe()
  })

  it('makes the next visit to the CI run list refetch it even inside the stale time', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue({ pages: [], pageParams: [] })

    markCiRunsStale(client, 'proj-1')
    const observer = new QueryObserver(client, {
      queryKey: ciRunKeys.page('proj-1'),
      queryFn,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1))
    unsubscribe()
  })
})
