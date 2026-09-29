import {
  postgresUniqueViolation,
  TEST_CASE_AUTOMATION_KEY_INDEX,
  TEST_CASE_NAME_INDEX,
  testCaseAutomationKeyViolation,
  testCaseNameViolation,
  testCaseVersionViolation,
} from '../../../../test/support/prisma-unique-violation';
import { testCaseUniqueConstraint } from './test-case-unique-constraint';

describe('testCaseUniqueConstraint', () => {
  it('recognizes the suite and name constraint', () => {
    expect(testCaseUniqueConstraint(testCaseNameViolation())).toBe('name');
  });

  it('recognizes the suite and automationKey constraint', () => {
    expect(testCaseUniqueConstraint(testCaseAutomationKeyViolation())).toBe(
      'automationKey',
    );
  });

  it('falls back to the index name when the key detail is missing', () => {
    expect(
      testCaseUniqueConstraint(
        postgresUniqueViolation({ index: TEST_CASE_AUTOMATION_KEY_INDEX }),
      ),
    ).toBe('automationKey');
    expect(
      testCaseUniqueConstraint(
        postgresUniqueViolation({ index: TEST_CASE_NAME_INDEX }),
      ),
    ).toBe('name');
  });

  it('reports unknown for a unique violation on another table', () => {
    expect(testCaseUniqueConstraint(testCaseVersionViolation())).toBe(
      'unknown',
    );
  });

  it('reports unknown when the error names no target at all', () => {
    expect(testCaseUniqueConstraint({ code: 'P2002' })).toBe('unknown');
  });
});
