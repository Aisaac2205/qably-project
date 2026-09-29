import { uniqueViolationTarget } from '../../../prisma/unique-violation-target';

export type TestCaseUniqueConstraint = 'name' | 'automationKey' | 'unknown';

const CONSTRAINT_BY_INDEX: Readonly<
  Record<string, Exclude<TestCaseUniqueConstraint, 'unknown'>>
> = {
  test_case_suiteId_name_key: 'name',
  test_case_suiteId_automationKey_key: 'automationKey',
};

const CONSTRAINT_BY_FIELDS: Readonly<
  Record<string, Exclude<TestCaseUniqueConstraint, 'unknown'>>
> = {
  'name,suiteId': 'name',
  'automationKey,suiteId': 'automationKey',
};

export function testCaseUniqueConstraint(
  error: unknown,
): TestCaseUniqueConstraint {
  const target = uniqueViolationTarget(error);
  if (target === null) return 'unknown';

  if (target.fields !== null) {
    const key = [...target.fields].sort().join(',');
    return CONSTRAINT_BY_FIELDS[key] ?? 'unknown';
  }

  if (target.constraint !== null) {
    return CONSTRAINT_BY_INDEX[target.constraint] ?? 'unknown';
  }

  return 'unknown';
}
