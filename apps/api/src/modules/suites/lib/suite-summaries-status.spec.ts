import {
  suiteSortKey,
  type RunStatus,
  type SuiteRunStatus,
  type SuiteSortSource,
  type SuiteSummarySort,
} from '@qably/types';
import {
  toSummaryBase,
  type SuiteSummaryRow,
} from './suite-summaries-candidates';
import { matchesFilters } from './suite-summaries-filters';
import {
  planStatusResolution,
  resolveSuiteSummaries,
  withRunStatus,
} from './suite-summaries-status';

function row(overrides: Partial<SuiteSummaryRow> = {}): SuiteSummaryRow {
  return {
    id: 'suite-1',
    projectId: 'project-1',
    name: 'Checkout',
    description: '',
    tags: [],
    isDefault: false,
    createdAt: new Date('2026-09-24T10:00:00.123Z'),
    _count: { cases: 0 },
    ...overrides,
  };
}

function at(seconds: number): Date {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
}

function base(id: string, overrides: Partial<SuiteSummaryRow> = {}) {
  return toSummaryBase(row({ id, ...overrides }));
}

function ids(page: readonly { id: string }[]): string[] {
  return page.map((item) => item.id);
}

function windowsOf(
  entries: Record<string, RunStatus[]>,
): Map<string, RunStatus[]> {
  return new Map(Object.entries(entries));
}

describe('withRunStatus', () => {
  it('derives status and rate from the window of that suite, oldest run first', () => {
    const windows = windowsOf({
      'suite-1': ['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'fail'],
      'suite-2': ['pass'],
    });

    expect(withRunStatus(base('suite-1'), windows)).toEqual({
      ...base('suite-1'),
      status: 'fail',
      recentPassRate: 86,
    });
    expect(withRunStatus(base('suite-2'), windows)).toEqual({
      ...base('suite-2'),
      status: 'pass',
      recentPassRate: 100,
    });
  });

  it('reports a suite without runs as never-run with a null rate instead of dropping it', () => {
    const windows = windowsOf({ other: ['pass'] });

    expect(withRunStatus(base('fresh'), windows)).toEqual({
      ...base('fresh'),
      status: 'never-run',
      recentPassRate: null,
    });
    expect(withRunStatus(base('fresh'), new Map())).toMatchObject({
      status: 'never-run',
      recentPassRate: null,
    });
  });

  it.each([
    ['a running run in the window', ['pass', 'running'], 'running', 100],
    ['a failing majority', ['fail', 'fail', 'pass'], 'needs-attention', 33],
    ['only open runs', ['pending'], 'needs-attention', null],
  ] as [string, RunStatus[], SuiteRunStatus, number | null][])(
    'derives the status for %s',
    (_label, statuses, status, recentPassRate) => {
      const windows = windowsOf({ 'suite-1': statuses });

      expect(withRunStatus(base('suite-1'), windows)).toMatchObject({
        status,
        recentPassRate,
      });
    },
  );

  it('keeps the summary fields of the candidate and does not change it', () => {
    const candidate = Object.freeze(
      base('suite-1', {
        name: 'Payments',
        tags: ['api'],
        isDefault: true,
        _count: { cases: 4 },
      }),
    );

    const resolved = withRunStatus(candidate, windowsOf({}));

    expect(resolved).toEqual({
      id: 'suite-1',
      projectId: 'project-1',
      name: 'Payments',
      description: '',
      tags: ['api'],
      isDefault: true,
      createdAt: '2026-09-24T10:00:00.123Z',
      caseCount: 4,
      status: 'never-run',
      recentPassRate: null,
    });
    expect(candidate).not.toHaveProperty('status');
  });
});

describe('resolveSuiteSummaries', () => {
  const candidates = [base('p'), base('f'), base('n')];
  const windows = windowsOf({
    p: ['pass', 'pass'],
    f: ['pass', 'pass', 'pass', 'fail'],
  });

  it.each([
    ['fail', ['f']],
    ['pass', ['p']],
    ['never-run', ['n']],
    ['running', []],
  ] as [SuiteRunStatus, string[]][])(
    'keeps only the suites whose derived status is %s',
    (status, expected) => {
      expect(ids(resolveSuiteSummaries(candidates, windows, status))).toEqual(
        expected,
      );
    },
  );

  it('keeps every suite, in order, when no status is requested', () => {
    expect(ids(resolveSuiteSummaries(candidates, windows, undefined))).toEqual([
      'p',
      'f',
      'n',
    ]);
  });

  it('returns the resolved summary with status and rate for each suite it keeps', () => {
    expect(resolveSuiteSummaries(candidates, windows, 'fail')).toEqual([
      { ...base('f'), status: 'fail', recentPassRate: 75 },
    ]);
  });

  it('includes a freshly created suite and no suite with runs for never-run', () => {
    const fresh = base('fresh', { createdAt: at(900) });
    const withFresh = [...candidates, fresh];

    expect(ids(resolveSuiteSummaries(withFresh, windows, 'never-run'))).toEqual(
      ['n', 'fresh'],
    );
  });

  it('finds a running run that sits ninth from the newest in the window', () => {
    const busyWindow: RunStatus[] = [
      'pass',
      'running',
      ...Array.from({ length: 8 }, (): RunStatus => 'pass'),
    ];
    const resolved = resolveSuiteSummaries(
      [base('busy'), base('calm')],
      windowsOf({ busy: busyWindow, calm: ['pass', 'pass'] }),
      'running',
    );

    expect(busyWindow).toHaveLength(10);
    expect(ids(resolved)).toEqual(['busy']);
  });

  describe('combined with the search and tag filters', () => {
    const suites = [
      base('a', { name: 'Checkout', tags: ['api'] }),
      base('b', { name: 'Checkout cart', tags: ['web'] }),
      base('c', { name: 'Billing', tags: ['api'] }),
      base('d', { name: 'Checkout export', tags: ['api'] }),
    ];
    const suiteWindows = windowsOf({
      a: ['pass'],
      b: ['pass'],
      c: ['pass'],
      d: ['pass', 'pass', 'pass', 'fail'],
    });

    const run = (search: string, tag: string, status: SuiteRunStatus) =>
      ids(
        resolveSuiteSummaries(
          suites.filter((suite) => matchesFilters(suite, { search, tag })),
          suiteWindows,
          status,
        ),
      );

    it('requires search, tag and status all at once', () => {
      expect(run('checkout', 'api', 'pass')).toEqual(['a']);
      expect(run('checkout', 'api', 'fail')).toEqual(['d']);
    });

    it('drops a suite that misses any one of the three', () => {
      expect(run('checkout', 'web', 'pass')).toEqual(['b']);
      expect(run('billing', 'api', 'fail')).toEqual([]);
      expect(run('cart', 'api', 'pass')).toEqual([]);
    });
  });
});

describe('planStatusResolution', () => {
  it.each([
    ['recent', undefined],
    ['name', undefined],
    ['cases', undefined],
  ] as [SuiteSummarySort, undefined][])(
    'cuts the page first for sort %s without a status filter',
    (sort, status) => {
      expect(planStatusResolution({ sort, status })).toEqual({
        order: 'page-first',
        sort,
      });
    },
  );

  it.each([
    ['pass-rate', undefined],
    ['recent', 'fail'],
    ['name', 'never-run'],
    ['cases', 'running'],
    ['pass-rate', 'pass'],
  ] as [SuiteSummarySort, SuiteRunStatus | undefined][])(
    'resolves the status before the cut for sort %s and status %s',
    (sort, status) => {
      expect(planStatusResolution({ sort, status })).toEqual({
        order: 'status-first',
        sort,
        status,
      });
    },
  );

  it('gives a page-first plan a sort that builds a key without a pass rate', () => {
    const plan = planStatusResolution({ sort: 'name', status: undefined });
    const item: SuiteSortSource = base('a', { name: 'Alpha' });

    if (plan.order !== 'page-first') {
      throw new Error('expected a page-first plan');
    }

    expect(suiteSortKey(item, plan.sort)).toEqual({
      sort: 'name',
      name: 'Alpha',
      id: 'a',
    });
  });
});
