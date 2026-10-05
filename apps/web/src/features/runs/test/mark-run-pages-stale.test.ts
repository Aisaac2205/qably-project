import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { runKeys } from '../lib/query-keys'
import { markRunPagesStale } from '../lib/mark-run-pages-stale'

function seededClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  client.setQueryData(runKeys.page('proj-1', 'manual'), { pages: [], pageParams: [] })
  client.setQueryData(runKeys.page('proj-1', 'all'), { pages: [], pageParams: [] })
  client.setQueryData(runKeys.page('proj-2', 'manual'), { pages: [], pageParams: [] })
  client.setQueryData(runKeys.page('proj-10', 'manual'), { pages: [], pageParams: [] })
  client.setQueryData(runKeys.detail('run-1'), { id: 'run-1' })
  client.setQueryData(runKeys.regressions('proj-1', 20), { items: [], runsScanned: 0 })
  client.setQueryData(runKeys.suiteMetrics('proj-1'), { items: [] })
  return client
}

describe('runKeys.pages', () => {
  it('is the prefix of every page key of one project, whatever the source', () => {
    expect(runKeys.pages('proj-1')).toEqual(['runs', 'page', 'proj-1'])
    expect(runKeys.page('proj-1', 'manual').slice(0, 3)).toEqual(runKeys.pages('proj-1'))
    expect(runKeys.page('proj-1', 'all').slice(0, 3)).toEqual(runKeys.pages('proj-1'))
  })

  it('never collides with the other run keys', () => {
    expect(runKeys.regressions('proj-1', 20).slice(0, 3)).not.toEqual(runKeys.pages('proj-1'))
    expect(runKeys.detail('proj-1').slice(0, 3)).not.toEqual(runKeys.pages('proj-1'))
    expect(runKeys.suiteMetrics('proj-1').slice(0, 3)).not.toEqual(runKeys.pages('proj-1'))
  })
})

describe('markRunPagesStale', () => {
  it('marks every cached page of the project stale, whatever the source', () => {
    const client = seededClient()

    markRunPagesStale(client, 'proj-1')

    expect(client.getQueryState(runKeys.page('proj-1', 'manual'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(runKeys.page('proj-1', 'all'))?.isInvalidated).toBe(true)
  })

  it('leaves the pages of other projects alone, even when their id starts with the same text', () => {
    const client = seededClient()

    markRunPagesStale(client, 'proj-1')

    expect(client.getQueryState(runKeys.page('proj-2', 'manual'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(runKeys.page('proj-10', 'manual'))?.isInvalidated).toBe(false)
  })

  it('leaves the run details, the regressions and the metrics alone', () => {
    const client = seededClient()

    markRunPagesStale(client, 'proj-1')

    expect(client.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(runKeys.regressions('proj-1', 20))?.isInvalidated).toBe(false)
    expect(client.getQueryState(runKeys.suiteMetrics('proj-1'))?.isInvalidated).toBe(false)
  })

  it('never fetches, so a mutation costs no request even for a page that still has an observer', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue({ pages: [], pageParams: [] })
    const observer = new QueryObserver(client, {
      queryKey: runKeys.page('proj-1', 'manual'),
      queryFn,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    markRunPagesStale(client, 'proj-1')
    await client.isFetching()
    unsubscribe()

    expect(queryFn).not.toHaveBeenCalled()
  })

  it('makes the next visit to the list refetch it even inside the stale time', async () => {
    const client = seededClient()
    const queryFn = vi.fn().mockResolvedValue({ pages: [], pageParams: [] })

    markRunPagesStale(client, 'proj-1')
    const observer = new QueryObserver(client, {
      queryKey: runKeys.page('proj-1', 'manual'),
      queryFn,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1))
    unsubscribe()
  })
})
