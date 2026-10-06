import {
  deriveSuiteRunStatus,
  type RunStatus,
  type SuiteRunStatus,
  type SuiteSummary,
  type SuiteSummarySort,
} from '@qably/types';
import type { SuiteSummaryBase } from './suite-summaries-candidates';

type RunStatusWindows = ReadonlyMap<string, readonly RunStatus[]>;

type StatusResolutionPlan =
  | {
      order: 'status-first';
      sort: SuiteSummarySort;
      status: SuiteRunStatus | undefined;
    }
  | { order: 'page-first'; sort: Exclude<SuiteSummarySort, 'pass-rate'> };

export function planStatusResolution(query: {
  sort: SuiteSummarySort;
  status?: SuiteRunStatus | undefined;
}): StatusResolutionPlan {
  if (query.sort === 'pass-rate' || query.status !== undefined) {
    return { order: 'status-first', sort: query.sort, status: query.status };
  }

  return { order: 'page-first', sort: query.sort };
}

export function withRunStatus(
  candidate: SuiteSummaryBase,
  windows: RunStatusWindows,
): SuiteSummary {
  return {
    ...candidate,
    ...deriveSuiteRunStatus(windows.get(candidate.id) ?? []),
  };
}

export function resolveSuiteSummaries(
  candidates: readonly SuiteSummaryBase[],
  windows: RunStatusWindows,
  status: SuiteRunStatus | undefined,
): SuiteSummary[] {
  return candidates
    .map((candidate) => withRunStatus(candidate, windows))
    .filter((summary) => status === undefined || summary.status === status);
}
