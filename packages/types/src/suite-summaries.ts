import type { SuiteRunStatus } from './index';

export const SUITE_SUMMARY_SORTS = ['recent', 'name', 'pass-rate', 'cases'] as const;
export type SuiteSummarySort = (typeof SUITE_SUMMARY_SORTS)[number];

export const SUITE_RUN_STATUSES = [
  'running',
  'pass',
  'fail',
  'needs-attention',
  'never-run',
] as const satisfies readonly SuiteRunStatus[];

export interface SuiteSummary {
  id: string;
  projectId: string;
  name: string;
  description: string;
  tags: string[];
  isDefault: boolean;
  createdAt: string;
  caseCount: number;
  status: SuiteRunStatus;
  recentPassRate: number | null;
}

export interface SuiteSummariesPage {
  items: SuiteSummary[];
  nextCursor: string | null;
}

export interface SuiteTagsFacet {
  items: string[];
}

export type SuiteSortKey =
  | { sort: 'recent'; createdAt: string; id: string }
  | { sort: 'name'; name: string; id: string }
  | { sort: 'pass-rate'; recentPassRate: number | null; createdAt: string; id: string }
  | { sort: 'cases'; caseCount: number; createdAt: string; id: string };

export type SuiteSortSource = Pick<SuiteSummary, 'id' | 'name' | 'createdAt' | 'caseCount'> &
  Partial<Pick<SuiteSummary, 'recentPassRate'>>;

const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base' });

export function suiteSortKey(item: SuiteSortSource, sort: SuiteSummarySort): SuiteSortKey {
  switch (sort) {
    case 'recent':
      return { sort, createdAt: item.createdAt, id: item.id };
    case 'name':
      return { sort, name: item.name, id: item.id };
    case 'pass-rate':
      return {
        sort,
        recentPassRate: item.recentPassRate ?? null,
        createdAt: item.createdAt,
        id: item.id,
      };
    case 'cases':
      return { sort, caseCount: item.caseCount, createdAt: item.createdAt, id: item.id };
  }
}

function compareCreatedAtNewestFirst(a: string, b: string): number {
  return Date.parse(b) - Date.parse(a);
}

function compareIdsAscending(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}

function compareIdsDescending(a: string, b: string): number {
  return compareIdsAscending(b, a);
}

function comparePassRatesHighestFirst(a: number | null, b: number | null): number {
  if (a === b) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return b - a;
}

export function compareSuiteSortKeys(a: SuiteSortKey, b: SuiteSortKey): number {
  if (a.sort === 'recent' && b.sort === 'recent') {
    return compareCreatedAtNewestFirst(a.createdAt, b.createdAt) || compareIdsDescending(a.id, b.id);
  }

  if (a.sort === 'name' && b.sort === 'name') {
    return NAME_COLLATOR.compare(a.name, b.name) || compareIdsAscending(a.id, b.id);
  }

  if (a.sort === 'pass-rate' && b.sort === 'pass-rate') {
    return (
      comparePassRatesHighestFirst(a.recentPassRate, b.recentPassRate) ||
      compareCreatedAtNewestFirst(a.createdAt, b.createdAt) ||
      compareIdsDescending(a.id, b.id)
    );
  }

  if (a.sort === 'cases' && b.sort === 'cases') {
    return (
      b.caseCount - a.caseCount ||
      compareCreatedAtNewestFirst(a.createdAt, b.createdAt) ||
      compareIdsDescending(a.id, b.id)
    );
  }

  throw new Error(`Cannot compare suite sort keys of different sorts: ${a.sort} and ${b.sort}`);
}
