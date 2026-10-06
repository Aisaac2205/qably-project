import { matchesSuiteSearch, type SuiteSummary } from '@qably/types';

interface SuiteSummaryFilters {
  search?: string | undefined;
  tag?: string | undefined;
}

export function matchesFilters(
  candidate: Pick<SuiteSummary, 'name' | 'description' | 'tags'>,
  filters: SuiteSummaryFilters,
): boolean {
  if (
    filters.search !== undefined &&
    !matchesSuiteSearch(candidate, filters.search)
  ) {
    return false;
  }

  return filters.tag === undefined || candidate.tags.includes(filters.tag);
}
