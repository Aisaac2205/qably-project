import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { suiteKeys } from '@/features/projects/lib/query-keys'

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
}

describe('suiteKeys', () => {
  it('keeps the list, detail and root keys unchanged', () => {
    expect(suiteKeys.all).toEqual(['suites'])
    expect(suiteKeys.list('proj-1')).toEqual(['suites', 'list', 'proj-1'])
    expect(suiteKeys.detail('suite-1')).toEqual(['suites', 'suite-1'])
  })

  it('prefixes the summaries and tags keys with the project', () => {
    expect(suiteKeys.summaries('proj-1')).toEqual(['suites', 'summaries', 'proj-1'])
    expect(suiteKeys.tags('proj-1')).toEqual(['suites', 'tags', 'proj-1'])
  })

  it('nests each summaries page key under the summaries prefix of its project', () => {
    const key = suiteKeys.summaryPage('proj-1', { sort: 'recent' })

    expect(key.slice(0, 3)).toEqual(suiteKeys.summaries('proj-1'))
    expect(key[3]).toEqual({ sort: 'recent' })
  })

  describe('against a query client', () => {
    it('stores each filter variant of a project under its own entry', () => {
      const client = createClient()
      const recent = suiteKeys.summaryPage('proj-1', { sort: 'recent' })
      const searched = suiteKeys.summaryPage('proj-1', { sort: 'recent', search: 'login' })
      const byName = suiteKeys.summaryPage('proj-1', { sort: 'name' })

      client.setQueryData(recent, 'recent-pages')
      client.setQueryData(searched, 'searched-pages')
      client.setQueryData(byName, 'name-pages')

      expect(client.getQueryData(recent)).toBe('recent-pages')
      expect(client.getQueryData(searched)).toBe('searched-pages')
      expect(client.getQueryData(byName)).toBe('name-pages')
    })

    it('reads a variant back from an equal query whatever the order of its fields', () => {
      const client = createClient()

      client.setQueryData(
        suiteKeys.summaryPage('proj-1', { sort: 'recent', status: 'fail', tag: 'api' }),
        'pages',
      )

      expect(
        client.getQueryData(
          suiteKeys.summaryPage('proj-1', { tag: 'api', status: 'fail', sort: 'recent' }),
        ),
      ).toBe('pages')
    })

    it('reaches every variant of one project, and only them, through the summaries prefix', () => {
      const client = createClient()
      client.setQueryData(suiteKeys.summaryPage('proj-1', { sort: 'recent' }), 'a')
      client.setQueryData(suiteKeys.summaryPage('proj-1', { sort: 'name' }), 'b')
      client.setQueryData(suiteKeys.summaryPage('proj-2', { sort: 'recent' }), 'c')
      client.setQueryData(suiteKeys.tags('proj-1'), 'tags')
      client.setQueryData(suiteKeys.list('proj-1'), 'list')

      const matched = client
        .getQueriesData({ queryKey: suiteKeys.summaries('proj-1') })
        .map(([, data]) => data)

      expect(matched.sort()).toEqual(['a', 'b'])
    })

    it('marks the summaries, the tags and the list as stale from the root key', async () => {
      const client = createClient()
      const keys = [
        suiteKeys.summaryPage('proj-1', { sort: 'recent' }),
        suiteKeys.tags('proj-1'),
        suiteKeys.list('proj-1'),
      ]
      for (const key of keys) client.setQueryData(key, 'seed')

      await client.invalidateQueries({ queryKey: suiteKeys.all, refetchType: 'none' })

      expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([
        true,
        true,
        true,
      ])
    })

    it('leaves the list cache alone when only the summaries of a project are invalidated', async () => {
      const client = createClient()
      const summaries = suiteKeys.summaryPage('proj-1', { sort: 'recent' })
      const list = suiteKeys.list('proj-1')
      client.setQueryData(summaries, 'seed')
      client.setQueryData(list, 'seed')

      await client.invalidateQueries({
        queryKey: suiteKeys.summaries('proj-1'),
        refetchType: 'none',
      })

      expect(client.getQueryState(summaries)?.isInvalidated).toBe(true)
      expect(client.getQueryState(list)?.isInvalidated).toBe(false)
    })
  })
})
