import type { ListSuiteSummariesParams } from '../api/suites.api'
import type { SortKey, StatusFilter, TagFilter } from './suite-filter-options'

export type SuiteSummariesQuery = Omit<
  ListSuiteSummariesParams,
  'projectId' | 'cursor' | 'limit'
>

export interface SuiteSummariesFilters {
  sort: SortKey
  search: string
  status: StatusFilter
  tag: TagFilter
}

export const SUITE_SEARCH_MAX_LENGTH = 200

export function toSuiteSummariesQuery({
  sort,
  search,
  status,
  tag,
}: SuiteSummariesFilters): SuiteSummariesQuery {
  const trimmedSearch = search.trim().slice(0, SUITE_SEARCH_MAX_LENGTH).trim()

  return {
    sort,
    ...(trimmedSearch === '' ? {} : { search: trimmedSearch }),
    ...(status === 'all' ? {} : { status }),
    ...(tag === 'all' || tag === '' ? {} : { tag }),
  }
}

export function hasSummariesFilter(filters: SuiteSummariesFilters): boolean {
  const { search, status, tag } = toSuiteSummariesQuery(filters)

  return search !== undefined || status !== undefined || tag !== undefined
}
