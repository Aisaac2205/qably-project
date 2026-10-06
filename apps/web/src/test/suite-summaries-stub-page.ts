import {
  compareSuiteSortKeys,
  suiteSortKey,
  type Suite,
  type SuiteSummariesPage,
} from '@qably/types'
import type { ListSuiteSummariesParams } from '@/features/projects/suites/api/suites.api'
import { encodeCursor } from './suite-summaries-stub-cursor'
import { orderSuiteSummaries, type SuiteRunSource } from './suite-summaries-stub'
import { validateSuiteSummariesRequest } from './suite-summaries-stub-validation'

export function pageSuiteSummaries(
  suites: readonly Suite[],
  runs: readonly SuiteRunSource[],
  params: ListSuiteSummariesParams,
): SuiteSummariesPage {
  const { limit, cursor } = validateSuiteSummariesRequest(params)
  const keyed = orderSuiteSummaries(suites, runs, params).map((summary) => ({
    summary,
    key: suiteSortKey(summary, params.sort),
  }))
  const remaining =
    cursor === undefined
      ? keyed
      : keyed.filter(({ key }) => compareSuiteSortKeys(key, cursor) > 0)
  const lookahead = remaining.slice(0, limit + 1)
  const taken = lookahead.slice(0, limit)
  const last = taken[taken.length - 1]

  return {
    items: taken.map(({ summary }) => summary),
    nextCursor: lookahead.length > limit && last !== undefined ? encodeCursor(last.key) : null,
  }
}
