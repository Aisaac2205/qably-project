import { wasRegression } from './regression-check';

describe('wasRegression', () => {
  it('returns false when there is no previous finished run', () => {
    expect(wasRegression('case-1', [])).toBe(false);
  });

  it('returns false when the previous run case was not pass', () => {
    const previousRunCases = [
      { testCaseId: 'case-1', status: 'fail' as const },
    ];

    expect(wasRegression('case-1', previousRunCases)).toBe(false);
  });

  it('returns true when the previous run case passed and now fails', () => {
    const previousRunCases = [
      { testCaseId: 'case-1', status: 'pass' as const },
    ];

    expect(wasRegression('case-1', previousRunCases)).toBe(true);
  });

  it('returns false when the current case has no linked testCaseId', () => {
    const previousRunCases = [
      { testCaseId: 'case-1', status: 'pass' as const },
    ];

    expect(wasRegression(null, previousRunCases)).toBe(false);
  });
});
