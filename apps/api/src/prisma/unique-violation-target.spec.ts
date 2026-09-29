import {
  postgresUniqueViolation,
  TEST_CASE_NAME_INDEX,
  testCaseAutomationKeyViolation,
  testCaseNameViolation,
} from '../../test/support/prisma-unique-violation';
import { uniqueViolationTarget } from './unique-violation-target';

describe('uniqueViolationTarget', () => {
  it('reads the unquoted columns and the index name from a driver adapter P2002', () => {
    expect(uniqueViolationTarget(testCaseNameViolation())).toEqual({
      fields: ['suiteId', 'name'],
      constraint: 'test_case_suiteId_name_key',
    });
  });

  it('keeps camelCase columns intact after removing the Postgres identifier quotes', () => {
    expect(uniqueViolationTarget(testCaseAutomationKeyViolation())).toEqual({
      fields: ['suiteId', 'automationKey'],
      constraint: 'test_case_suiteId_automationKey_key',
    });
  });

  it('falls back to the index name when Postgres sent no key detail', () => {
    expect(
      uniqueViolationTarget(
        postgresUniqueViolation({ index: TEST_CASE_NAME_INDEX }),
      ),
    ).toEqual({ fields: null, constraint: 'test_case_suiteId_name_key' });
  });

  it('reads meta.target when an engine reports the columns there', () => {
    expect(
      uniqueViolationTarget({
        code: 'P2002',
        meta: { target: ['suiteId', 'name'] },
      }),
    ).toEqual({ fields: ['suiteId', 'name'], constraint: null });
  });

  it('reports no target for a bare P2002 without meta', () => {
    expect(uniqueViolationTarget({ code: 'P2002' })).toEqual({
      fields: null,
      constraint: null,
    });
  });

  it('returns null for anything that is not a unique violation', () => {
    expect(uniqueViolationTarget({ code: 'P2025' })).toBeNull();
    expect(uniqueViolationTarget(new Error('connection lost'))).toBeNull();
    expect(uniqueViolationTarget(null)).toBeNull();
  });
});
