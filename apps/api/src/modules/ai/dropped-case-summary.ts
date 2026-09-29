export interface CaseIssue {
  readonly path: readonly PropertyKey[];
  readonly code?: string;
}

const CASE_LABEL = 'case';
const UNKNOWN_CODE = 'unknown';

function fieldOf(path: readonly PropertyKey[]): string {
  const label = path.reduce<string>((joined, segment) => {
    if (typeof segment === 'number') return `${joined}[]`;
    return joined === '' ? String(segment) : `${joined}.${String(segment)}`;
  }, '');

  return label === '' ? CASE_LABEL : label;
}

function byFrequencyThenName(
  [leftKey, leftCount]: [string, number],
  [rightKey, rightCount]: [string, number],
): number {
  if (leftCount !== rightCount) return rightCount - leftCount;
  if (leftKey === rightKey) return 0;
  return leftKey < rightKey ? -1 : 1;
}

export function summarizeDroppedCases(
  droppedCases: readonly (readonly CaseIssue[])[],
): string {
  const casesPerFailure = new Map<string, number>();

  for (const issues of droppedCases) {
    const failures = new Set(
      issues.map(
        (issue) => `${fieldOf(issue.path)} ${issue.code ?? UNKNOWN_CODE}`,
      ),
    );

    for (const failure of failures) {
      casesPerFailure.set(failure, (casesPerFailure.get(failure) ?? 0) + 1);
    }
  }

  return [...casesPerFailure]
    .sort(byFrequencyThenName)
    .map(([failure, count]) => `${failure} x${count}`)
    .join(', ');
}
