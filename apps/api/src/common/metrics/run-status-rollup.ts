import type { RunStatus } from '@qably/types';

export const STATUS_PRECEDENCE: readonly RunStatus[] = [
  'fail',
  'running',
  'pending',
  'pass',
];

export function rollUpStatus(
  current: RunStatus,
  incoming: RunStatus,
): RunStatus {
  return STATUS_PRECEDENCE.indexOf(incoming) <
    STATUS_PRECEDENCE.indexOf(current)
    ? incoming
    : current;
}
