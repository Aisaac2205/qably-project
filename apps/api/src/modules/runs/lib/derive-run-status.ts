import type { CaseStatus, RunStatus } from '@qably/types';

export function deriveRunStatus(
  caseStatuses: readonly CaseStatus[],
): RunStatus {
  if (caseStatuses.some((status) => status === 'fail')) return 'fail';
  if (
    caseStatuses.some((status) => status === 'pending' || status === 'running')
  ) {
    return 'running';
  }

  const hasNonBlockedOutcome = caseStatuses.some(
    (status) => status === 'pass' || status === 'skip',
  );

  return hasNonBlockedOutcome ? 'pass' : 'fail';
}
