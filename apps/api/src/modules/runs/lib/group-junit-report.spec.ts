import type { JunitReport } from './parse-junit-xml';
import {
  groupJunitReportBySuite,
  JunitGroupingError,
} from './group-junit-report';

function report(cases: JunitReport['cases']): JunitReport {
  return { suiteName: 'root', cases };
}

describe('groupJunitReportBySuite', () => {
  it('returns a single group with the externalId unchanged when there is one suite', () => {
    const groups = groupJunitReportBySuite(
      report([
        { name: 'a', suiteName: 'Checkout', status: 'pass' },
        { name: 'b', suiteName: 'Checkout', status: 'fail' },
      ]),
      'gha-42',
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].suiteName).toBe('Checkout');
    expect(groups[0].externalId).toBe('gha-42');
    expect(groups[0].cases).toHaveLength(2);
  });

  it('splits into one group per distinct suiteName, in first-seen order', () => {
    const groups = groupJunitReportBySuite(
      report([
        { name: 'a', suiteName: 'src/a.test.ts', status: 'pass' },
        { name: 'b', suiteName: 'src/b.test.ts', status: 'pass' },
        { name: 'c', suiteName: 'src/c.test.ts', status: 'fail' },
      ]),
      'gha-42',
    );

    expect(groups.map((group) => group.suiteName)).toEqual([
      'src/a.test.ts',
      'src/b.test.ts',
      'src/c.test.ts',
    ]);
  });

  it("keeps a later case for an already-seen suite in that suite's original group", () => {
    const groups = groupJunitReportBySuite(
      report([
        { name: 'a1', suiteName: 'src/a.test.ts', status: 'pass' },
        { name: 'b1', suiteName: 'src/b.test.ts', status: 'pass' },
        { name: 'a2', suiteName: 'src/a.test.ts', status: 'fail' },
      ]),
      'gha-42',
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].suiteName).toBe('src/a.test.ts');
    expect(groups[0].cases.map((testCase) => testCase.name)).toEqual([
      'a1',
      'a2',
    ]);
  });

  it('derives a distinct, deterministic externalId suffix per suite when there are several', () => {
    const groups = groupJunitReportBySuite(
      report([
        { name: 'a', suiteName: 'src/a.test.ts', status: 'pass' },
        { name: 'b', suiteName: 'src/b.test.ts', status: 'pass' },
      ]),
      'gha-42',
    );

    for (const group of groups) {
      expect(group.externalId).toMatch(/^gha-42-[a-z0-9-]+-[0-9a-f]{8}$/);
    }
    expect(groups[0].externalId).not.toBe(groups[1].externalId);

    const again = groupJunitReportBySuite(
      report([
        { name: 'a', suiteName: 'src/a.test.ts', status: 'pass' },
        { name: 'b', suiteName: 'src/b.test.ts', status: 'pass' },
      ]),
      'gha-42',
    );
    expect(again[0].externalId).toBe(groups[0].externalId);
  });

  it('caps the slug segment of a derived externalId at 60 characters', () => {
    const longName = 'src/'.concat(
      'very-long-directory-name/'.repeat(10),
      'file.test.ts',
    );
    const groups = groupJunitReportBySuite(
      report([
        { name: 'a', suiteName: longName, status: 'pass' },
        { name: 'b', suiteName: 'src/short.test.ts', status: 'pass' },
      ]),
      'gha-42',
    );

    const [, slug] = groups[0].externalId
      .split(/^gha-42-/)[1]
      .match(/^(.+)-[0-9a-f]{8}$/) as [string, string];
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it('throws a typed error when the report groups into more than 500 distinct suites', () => {
    const cases = Array.from({ length: 501 }, (_unused, index) => ({
      name: 'only',
      suiteName: `suite-${index}`,
      status: 'pass' as const,
    }));

    expect(() => groupJunitReportBySuite(report(cases), 'gha-42')).toThrow(
      JunitGroupingError,
    );

    try {
      groupJunitReportBySuite(report(cases), 'gha-42');
      throw new Error('expected groupJunitReportBySuite to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(JunitGroupingError);
      expect((error as JunitGroupingError).code).toBe('group-limit-exceeded');
    }
  });
});
