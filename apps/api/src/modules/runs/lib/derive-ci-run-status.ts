import type { CiRunStatus, RunStatus } from '@qably/types';

export function deriveCiRunStatus(
  runStatuses: readonly RunStatus[],
): CiRunStatus {
  return runStatuses.some((status) => status === 'fail')
    ? 'failing'
    : 'passing';
}
