import type { CaseStatus } from '@qably/types';

export interface PreviousRunCase {
  testCaseId: string | null;
  status: CaseStatus;
}

export type CaseDelta = 'regression' | 'fix' | 'unchanged' | 'new';

export interface CurrentRunCase {
  testCaseId: string | null;
  status: CaseStatus;
}

export function classifyCaseDelta(
  current: CurrentRunCase,
  previousRunCases: readonly PreviousRunCase[],
): CaseDelta {
  if (current.testCaseId === null) return 'new';

  const previous = previousRunCases.find(
    (row) => row.testCaseId === current.testCaseId,
  );
  if (previous === undefined) return 'new';

  if (previous.status === 'pass' && current.status === 'fail') {
    return 'regression';
  }
  if (previous.status === 'fail' && current.status === 'pass') return 'fix';

  return 'unchanged';
}

export function wasRegression(
  currentTestCaseId: string | null,
  previousRunCases: readonly PreviousRunCase[],
): boolean {
  return (
    classifyCaseDelta(
      { testCaseId: currentTestCaseId, status: 'fail' },
      previousRunCases,
    ) === 'regression'
  );
}
