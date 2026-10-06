import { QueryClient } from '@tanstack/react-query'
import type { SuiteSummary } from '@qably/types'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import type { SuiteSummariesData } from '@/features/projects/suites/lib/suite-summaries-cache'
import { suite } from '@/test/suite-summaries-fixtures'
import { summary } from './suite-summaries-test-data'

export const RECENT = suiteKeys.summaryPage('proj-1', { sort: 'recent' })
export const SEARCH = suiteKeys.summaryPage('proj-1', { sort: 'name', search: 'x' })
export const OTHER_PROJECT = suiteKeys.summaryPage('proj-2', { sort: 'recent' })
export const LOOKALIKE_PROJECT = suiteKeys.summaryPage('proj-10', { sort: 'recent' })

export function dataOf(...pages: SuiteSummary[][]): SuiteSummariesData {
  return {
    pages: pages.map((items, index) => ({
      items,
      nextCursor: index === pages.length - 1 ? null : `cursor-${index + 1}`,
    })),
    pageParams: pages.map((_page, index) => (index === 0 ? undefined : `cursor-${index}`)),
  }
}

export function seededClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  const crowned = summary('a', {
    name: 'Alpha',
    isDefault: true,
    status: 'pass',
    recentPassRate: 100,
    caseCount: 1,
  })
  const target = summary('c', {
    name: 'Gamma',
    description: 'old description',
    tags: ['old'],
    status: 'needs-attention',
    recentPassRate: 60,
    caseCount: 0,
  })

  client.setQueryData(
    RECENT,
    dataOf([crowned, summary('b', { status: 'fail', recentPassRate: 40 })], [target, summary('d')]),
  )
  client.setQueryData(SEARCH, dataOf([target, summary('e')]))
  client.setQueryData(
    OTHER_PROJECT,
    dataOf([
      summary('z', { projectId: 'proj-2', isDefault: true }),
      summary('y', { projectId: 'proj-2' }),
    ]),
  )
  client.setQueryData(
    LOOKALIKE_PROJECT,
    dataOf([summary('c', { projectId: 'proj-10', name: 'Same id, other project', isDefault: true })]),
  )
  client.setQueryData(suiteKeys.tags('proj-1'), { items: ['old'] })
  client.setQueryData(suiteKeys.tags('proj-2'), { items: ['other'] })
  client.setQueryData(suiteKeys.list('proj-1'), [suite('c')])
  client.setQueryData(suiteKeys.detail('c'), suite('c'))

  return client
}

export function itemsOf(client: QueryClient, key: readonly unknown[]): SuiteSummary[] {
  const cached = client.getQueryData<SuiteSummariesData>(key)

  return cached?.pages.flatMap((page) => page.items) ?? []
}

export function itemOf(
  client: QueryClient,
  key: readonly unknown[],
  id: string,
): SuiteSummary | undefined {
  return itemsOf(client, key).find((item) => item.id === id)
}

export function idsIn(client: QueryClient, key: readonly unknown[]): string[] {
  return itemsOf(client, key).map((item) => item.id)
}
