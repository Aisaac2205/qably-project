import {
  collectSuiteTags,
  compareSuiteSortKeys,
  deriveSuiteRunStatus,
  matchesSuiteSearch,
  suiteSortKey,
  type RunStatus,
  type Suite,
  type SuiteSummary,
  type SuiteTagsFacet,
} from '@qably/types'
import type { ListSuiteSummariesParams } from '@/features/projects/suites/api/suites.api'

export interface SuiteRunSource {
  id: string
  suiteId: string
  status: RunStatus
  startedAt: string
}

export type SuiteSummariesSelection = Pick<
  ListSuiteSummariesParams,
  'projectId' | 'sort' | 'search' | 'status' | 'tag'
>

function compareRunsNewestFirst(a: SuiteRunSource, b: SuiteRunSource): number {
  const byStart = Date.parse(b.startedAt) - Date.parse(a.startedAt)

  if (byStart !== 0) return byStart

  return a.id === b.id ? 0 : a.id < b.id ? 1 : -1
}

function statusesOldestFirst(runs: readonly SuiteRunSource[], suiteId: string): RunStatus[] {
  return runs
    .filter((run) => run.suiteId === suiteId)
    .sort(compareRunsNewestFirst)
    .reverse()
    .map((run) => run.status)
}

function toSummary(suite: Suite, runs: readonly SuiteRunSource[]): SuiteSummary {
  return {
    id: suite.id,
    projectId: suite.projectId,
    name: suite.name,
    description: suite.description,
    tags: [...suite.tags],
    isDefault: suite.isDefault,
    createdAt: new Date(suite.createdAt).toISOString(),
    caseCount: suite.cases.length,
    ...deriveSuiteRunStatus(statusesOldestFirst(runs, suite.id)),
  }
}

export function orderSuiteSummaries(
  suites: readonly Suite[],
  runs: readonly SuiteRunSource[],
  selection: SuiteSummariesSelection,
): SuiteSummary[] {
  return suites
    .filter((suite) => suite.projectId === selection.projectId)
    .filter((suite) => selection.search === undefined || matchesSuiteSearch(suite, selection.search))
    .filter((suite) => selection.tag === undefined || suite.tags.includes(selection.tag))
    .map((suite) => toSummary(suite, runs))
    .filter((summary) => selection.status === undefined || summary.status === selection.status)
    .map((summary) => ({ summary, key: suiteSortKey(summary, selection.sort) }))
    .sort((a, b) => compareSuiteSortKeys(a.key, b.key))
    .map(({ summary }) => summary)
}

export function collectProjectSuiteTags(
  suites: readonly Suite[],
  projectId: string,
): SuiteTagsFacet {
  return {
    items: collectSuiteTags(
      suites.filter((suite) => suite.projectId === projectId).map((suite) => suite.tags),
    ),
  }
}
