import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { Suite, SuiteSummariesPage, SuiteSummary } from '@qably/types'
import { suiteKeys } from '../../lib/query-keys'

export type SuiteSummariesData = InfiniteData<SuiteSummariesPage, string | undefined>

type ItemRewrite = (item: SuiteSummary) => SuiteSummary | null

function rewriteItems(
  data: SuiteSummariesData | undefined,
  rewrite: ItemRewrite,
): SuiteSummariesData | undefined {
  if (data === undefined) return undefined

  let changed = false
  const pages = data.pages.map((page) => {
    const items: SuiteSummary[] = []

    for (const item of page.items) {
      const next = rewrite(item)

      if (next !== item) changed = true
      if (next !== null) items.push(next)
    }

    return { ...page, items }
  })

  return changed ? { ...data, pages } : undefined
}

function applySuite(item: SuiteSummary, suite: Suite): SuiteSummary {
  if (item.id === suite.id) {
    return {
      ...item,
      name: suite.name,
      description: suite.description,
      tags: suite.tags,
      isDefault: suite.isDefault,
      caseCount: suite.cases.length,
    }
  }

  return suite.isDefault && item.isDefault ? { ...item, isDefault: false } : item
}

export function patchSuiteSummaries(queryClient: QueryClient, suite: Suite) {
  queryClient.setQueriesData<SuiteSummariesData>(
    { queryKey: suiteKeys.summaries(suite.projectId) },
    (data) => rewriteItems(data, (item) => applySuite(item, suite)),
  )
}

export function removeFromSuiteSummaries(
  queryClient: QueryClient,
  projectId: string,
  suiteId: string,
) {
  queryClient.setQueriesData<SuiteSummariesData>(
    { queryKey: suiteKeys.summaries(projectId) },
    (data) => rewriteItems(data, (item) => (item.id === suiteId ? null : item)),
  )
}

export async function invalidateSuiteSummaries(queryClient: QueryClient, projectId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: suiteKeys.summaries(projectId) }),
    queryClient.invalidateQueries({ queryKey: suiteKeys.tags(projectId) }),
  ])
}

export function markSuiteSummariesStale(queryClient: QueryClient, projectId: string) {
  void queryClient.invalidateQueries({
    queryKey: suiteKeys.summaries(projectId),
    refetchType: 'none',
  })
}
