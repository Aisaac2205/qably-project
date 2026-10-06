import {
  deriveSuiteRunStatus,
  type RunStatus,
  type SuiteRunStatus,
  type SuiteSummary,
  type SuiteSummarySort,
} from '@qably/types';
import type { SuiteSummaryBase } from './suite-summaries-candidates';

export type RunStatusWindows = ReadonlyMap<string, readonly RunStatus[]>;

export function needsStatusBeforeCut(query: {
  sort: SuiteSummarySort;
  status?: SuiteRunStatus | undefined;
}): boolean {
  return query.sort === 'pass-rate' || query.status !== undefined;
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
