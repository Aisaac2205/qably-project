import {
  compareSuiteSortKeys,
  deriveSuiteRunStatus,
  matchesSuiteSearch,
  type RunStatus,
  type SuiteRunStatus,
  type SuiteSortKey,
  type SuiteSummary,
} from '@qably/types';
import type { ListSuiteSummariesQuery } from '../suites.schemas';
import { encodeSuiteSummariesCursor } from './suite-summaries-cursor';

export type SuiteSummaryBase = Omit<SuiteSummary, 'status' | 'recentPassRate'>;

export interface PagingWindow {
  limit: number;
  cursor?: SuiteSortKey | undefined;
}

export interface CutPage<T> {
  page: T[];
  nextCursor: string | null;
}

export interface SuiteSummaryRow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  tags: string[];
  isDefault: boolean;
  createdAt: Date;
  _count: { cases: number };
}

export function toSummaryBase(row: SuiteSummaryRow): SuiteSummaryBase {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    tags: row.tags,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    caseCount: row._count.cases,
  };
}

export function matchesFilters(
  candidate: Pick<SuiteSummary, 'name' | 'description' | 'tags'>,
  filters: Pick<ListSuiteSummariesQuery, 'search' | 'tag'>,
): boolean {
  if (
    filters.search !== undefined &&
    !matchesSuiteSearch(candidate, filters.search)
  ) {
    return false;
  }

  return filters.tag === undefined || candidate.tags.includes(filters.tag);
}

export function needsStatusBeforeCut(
  query: Pick<ListSuiteSummariesQuery, 'sort' | 'status'>,
): boolean {
  return query.sort === 'pass-rate' || query.status !== undefined;
}

export function withRunStatus(
  candidate: SuiteSummaryBase,
  windows: ReadonlyMap<string, readonly RunStatus[]>,
): SuiteSummary {
  return {
    ...candidate,
    ...deriveSuiteRunStatus(windows.get(candidate.id) ?? []),
  };
}

export function resolveSuiteSummaries(
  candidates: readonly SuiteSummaryBase[],
  windows: ReadonlyMap<string, readonly RunStatus[]>,
  status: SuiteRunStatus | undefined,
): SuiteSummary[] {
  return candidates
    .map((candidate) => withRunStatus(candidate, windows))
    .filter((summary) => status === undefined || summary.status === status);
}

export function cutPage<T>(
  items: readonly T[],
  keyOf: (item: T) => SuiteSortKey,
  { limit, cursor }: PagingWindow,
): CutPage<T> {
  const ordered = items
    .map((item) => ({ item, key: keyOf(item) }))
    .sort((a, b) => compareSuiteSortKeys(a.key, b.key));
  const remaining =
    cursor === undefined
      ? ordered
      : ordered.filter(({ key }) => compareSuiteSortKeys(key, cursor) > 0);
  const lookahead = remaining.slice(0, limit + 1);
  const taken = lookahead.slice(0, limit);
  const last = taken[taken.length - 1];

  return {
    page: taken.map(({ item }) => item),
    nextCursor:
      lookahead.length > limit && last !== undefined
        ? encodeSuiteSummariesCursor(last.key)
        : null,
  };
}
