import type { RunStatus, SuiteRunStatus } from './index';

export const SUITE_RUN_WINDOW = 10;
export const SUITE_PASS_RATE_THRESHOLD = 70;

export interface SuiteRunStatusResult {
  status: SuiteRunStatus;
  recentPassRate: number | null;
}

function isCompleted(status: RunStatus): boolean {
  return status === 'pass' || status === 'fail';
}

function toPassRate(completed: readonly RunStatus[]): number | null {
  if (completed.length === 0) {
    return null;
  }

  const passed = completed.filter((status) => status === 'pass').length;

  return Math.round((passed / completed.length) * 100);
}

export function deriveSuiteRunStatus(
  oldestFirst: readonly RunStatus[],
): SuiteRunStatusResult {
  const window = oldestFirst.slice(-SUITE_RUN_WINDOW);
  const completed = window.filter(isCompleted);
  const recentPassRate = toPassRate(completed);

  if (window.includes('running')) {
    return { status: 'running', recentPassRate };
  }

  if (window.length === 0) {
    return { status: 'never-run', recentPassRate };
  }

  if (recentPassRate === null || recentPassRate < SUITE_PASS_RATE_THRESHOLD) {
    return { status: 'needs-attention', recentPassRate };
  }

  return { status: completed.at(-1) === 'pass' ? 'pass' : 'fail', recentPassRate };
}
