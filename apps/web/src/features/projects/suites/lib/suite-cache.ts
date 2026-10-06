import type { QueryClient } from '@tanstack/react-query'
import type { Project, Suite } from '@qably/types'
import { projectKeys, suiteKeys } from '../../lib/query-keys'

export function patchSuiteList(queryClient: QueryClient, fresh: Suite) {
  const listKey = suiteKeys.list(fresh.projectId)
  const cached = queryClient.getQueryData<Suite[]>(listKey)

  if (cached === undefined) return

  const known = cached.some((entry) => entry.id === fresh.id)
  const merged = known
    ? cached.map((entry) => (entry.id === fresh.id ? fresh : entry))
    : [fresh, ...cached]
  const demotedIds = new Set(
    fresh.isDefault
      ? merged.filter((entry) => entry.id !== fresh.id && entry.isDefault).map((entry) => entry.id)
      : [],
  )

  queryClient.setQueryData<Suite[]>(
    listKey,
    demotedIds.size === 0
      ? merged
      : merged.map((entry) => (demotedIds.has(entry.id) ? { ...entry, isDefault: false } : entry)),
  )

  for (const id of demotedIds) {
    void queryClient.invalidateQueries({ queryKey: suiteKeys.detail(id), refetchType: 'none' })
  }
}

export function invalidateSuiteList(queryClient: QueryClient, projectId: string) {
  return queryClient.invalidateQueries({ queryKey: suiteKeys.list(projectId) })
}

export function markProjectStale(queryClient: QueryClient, projectId: string) {
  void queryClient.invalidateQueries({
    queryKey: projectKeys.detail(projectId),
    refetchType: 'none',
  })
}

function reflectManualCases(queryClient: QueryClient, suite: Suite) {
  const hasActiveManualCase = suite.cases.some(
    (entry) => entry.executionMode === 'manual' && entry.state === 'active',
  )

  if (!hasActiveManualCase) return

  queryClient.setQueryData<Project>(projectKeys.detail(suite.projectId), (cached) =>
    cached === undefined || cached.hasManualCases === true
      ? undefined
      : { ...cached, hasManualCases: true },
  )
}

export async function adoptSuite(queryClient: QueryClient, suite: Suite) {
  const detailKey = suiteKeys.detail(suite.id)

  await queryClient.cancelQueries({ queryKey: detailKey, exact: true })
  queryClient.setQueryData(detailKey, suite)
  patchSuiteList(queryClient, suite)
  reflectManualCases(queryClient, suite)
  void invalidateSuiteList(queryClient, suite.projectId)
}

export function evictSuiteDetail(queryClient: QueryClient, suiteId: string) {
  const cache = queryClient.getQueryCache()
  const filters = { queryKey: suiteKeys.detail(suiteId), exact: true }
  const query = cache.find(filters)

  if (query === undefined) return

  if (query.getObserversCount() === 0) {
    queryClient.removeQueries(filters)
    return
  }

  const unsubscribe = cache.subscribe((event) => {
    if (event.type !== 'observerRemoved' || event.query !== query) return
    if (query.getObserversCount() > 0) return

    unsubscribe()
    queryClient.removeQueries(filters)
  })
}
