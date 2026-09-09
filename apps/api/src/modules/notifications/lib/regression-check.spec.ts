import { classifyCaseDelta, wasRegression } from './regression-check';

describe('classifyCaseDelta', () => {
  const previous = [
    { testCaseId: 'case-pass', status: 'pass' as const },
    { testCaseId: 'case-fail', status: 'fail' as const },
    { testCaseId: 'case-skip', status: 'skip' as const },
  ];

  it('classifies every case as new when the suite has no previous run', () => {
    expect(
      classifyCaseDelta({ testCaseId: 'case-pass', status: 'pass' }, []),
    ).toBe('new');
  });

  it('classifies a case absent from the previous run as new', () => {
    expect(
      classifyCaseDelta({ testCaseId: 'case-added', status: 'fail' }, previous),
    ).toBe('new');
  });

  it('classifies a case with no linked test case as new, since it cannot be compared', () => {
    expect(classifyCaseDelta({ testCaseId: null, status: 'fail' }, previous)).toBe(
      'new',
    );
  });

  it('classifies pass then fail as a regression', () => {
    expect(
      classifyCaseDelta({ testCaseId: 'case-pass', status: 'fail' }, previous),
    ).toBe('regression');
  });

  it('classifies fail then pass as a fix', () => {
    expect(
      classifyCaseDelta({ testCaseId: 'case-fail', status: 'pass' }, previous),
    ).toBe('fix');
  });

  it('classifies the same status twice as unchanged', () => {
    expect(
      classifyCaseDelta({ testCaseId: 'case-pass', status: 'pass' }, previous),
    ).toBe('unchanged');
    expect(
      classifyCaseDelta({ testCaseId: 'case-fail', status: 'fail' }, previous),
    ).toBe('unchanged');
  });

  it('does not call a skipped case that now fails a regression, because nothing passed before', () => {
    expect(
      classifyCaseDelta({ testCaseId: 'case-skip', status: 'fail' }, previous),
    ).toBe('unchanged');
  });

  it('does not call a skipped case that now passes a fix, because nothing failed before', () => {
    expect(
      classifyCaseDelta({ testCaseId: 'case-skip', status: 'pass' }, previous),
    ).toBe('unchanged');
  });
});

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
