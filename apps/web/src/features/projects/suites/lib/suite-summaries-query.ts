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

export function toSuiteSummariesQuery({
  sort,
  search,
  status,
  tag,
}: SuiteSummariesFilters): SuiteSummariesQuery {
  const trimmedSearch = search.trim()

  return {
    sort,
    ...(trimmedSearch === '' ? {} : { search: trimmedSearch }),
    ...(status === 'all' ? {} : { status }),
    ...(tag === 'all' || tag === '' ? {} : { tag }),
  }
}
