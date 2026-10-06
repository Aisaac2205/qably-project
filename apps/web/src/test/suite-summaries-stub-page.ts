import {
  compareSuiteSortKeys,
  suiteSortKey,
  type Suite,
  type SuiteSortKey,
  type SuiteSummariesPage,
  type SuiteSummarySort,
} from '@qably/types'
import type { ListSuiteSummariesParams } from '@/features/projects/suites/api/suites.api'
import { orderSuiteSummaries, type SuiteRunSource } from './suite-summaries-stub'

const DEFAULT_LIMIT = 50
const MIN_LIMIT = 1
const MAX_LIMIT = 100
const CURSOR_PREFIX = 'stub-cursor:'

function encodeCursor(key: SuiteSortKey): string {
  return `${CURSOR_PREFIX}${JSON.stringify(key)}`
}

function decodeCursor(cursor: string, sort: SuiteSummarySort): SuiteSortKey {
  const invalid = new Error('Invalid suite summaries cursor')

  if (!cursor.startsWith(CURSOR_PREFIX)) throw invalid

  let parsed: unknown

  try {
    parsed = JSON.parse(cursor.slice(CURSOR_PREFIX.length))
  } catch {
    throw invalid
  }

  if (typeof parsed !== 'object' || parsed === null) throw invalid

  const key = parsed as Partial<SuiteSortKey>

  if (key.sort !== sort || typeof key.id !== 'string') throw invalid

  return key as SuiteSortKey
}

function resolveLimit(limit: number | undefined): number {
  const resolved = limit ?? DEFAULT_LIMIT

  if (!Number.isInteger(resolved) || resolved < MIN_LIMIT || resolved > MAX_LIMIT) {
    throw new Error(`Invalid suite summaries limit: ${resolved}`)
  }

  return resolved
}

export function pageSuiteSummaries(
  suites: readonly Suite[],
  runs: readonly SuiteRunSource[],
  params: ListSuiteSummariesParams,
): SuiteSummariesPage {
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
