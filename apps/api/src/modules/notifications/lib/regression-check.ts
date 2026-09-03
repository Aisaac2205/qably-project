import type { CaseStatus } from '@qably/types';

export interface PreviousRunCase {
  testCaseId: string | null;
  status: CaseStatus;
}

export function wasRegression(
  currentTestCaseId: string | null,
  previousRunCases: readonly PreviousRunCase[],
): boolean {
  if (currentTestCaseId === null) return false;

  return previousRunCases.some(
    (row) => row.testCaseId === currentTestCaseId && row.status === 'pass',
  );
}
