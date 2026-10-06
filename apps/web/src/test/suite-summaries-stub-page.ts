import {
  SUITE_RUN_STATUSES,
  SUITE_SUMMARY_SORTS,
  compareSuiteSortKeys,
  suiteSortKey,
  type Suite,
  type SuiteSummariesPage,
} from '@qably/types'
import type { ListSuiteSummariesParams } from '@/features/projects/suites/api/suites.api'
import { decodeCursor, encodeCursor } from './suite-summaries-stub-cursor'
import { orderSuiteSummaries, type SuiteRunSource } from './suite-summaries-stub'

const DEFAULT_LIMIT = 50
const MIN_LIMIT = 1
const MAX_LIMIT = 100
const MAX_SEARCH_LENGTH = 200
const MAX_TAG_LENGTH = 40

function resolveLimit(limit: number | undefined): number {
  const resolved = limit ?? DEFAULT_LIMIT

  if (!Number.isInteger(resolved) || resolved < MIN_LIMIT || resolved > MAX_LIMIT) {
    throw new Error(`Invalid suite summaries limit: ${resolved}`)
  }

  return resolved
}

function assertValidSelection({ sort, search, tag, status }: ListSuiteSummariesParams): void {
  if (!SUITE_SUMMARY_SORTS.includes(sort)) {
    throw new Error(`Invalid suite summaries sort: ${sort}`)
  }

  if (search !== undefined) {
    const length = search.trim().length

    if (length < 1 || length > MAX_SEARCH_LENGTH) {
      throw new Error(`Invalid suite summaries search of ${length} characters`)
    }
  }

  if (tag !== undefined && (tag.length < 1 || tag.length > MAX_TAG_LENGTH)) {
    throw new Error(`Invalid suite summaries tag of ${tag.length} characters`)
  }

  if (status !== undefined && !SUITE_RUN_STATUSES.includes(status)) {
    throw new Error(`Invalid suite summaries status: ${status}`)
  }
}

export function pageSuiteSummaries(
  suites: readonly Suite[],
  runs: readonly SuiteRunSource[],
  params: ListSuiteSummariesParams,
): SuiteSummariesPage {
  assertValidSelection(params)
  const limit = resolveLimit(params.limit)
  const cursor =
    params.cursor === undefined ? undefined : decodeCursor(params.cursor, params.sort)
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
