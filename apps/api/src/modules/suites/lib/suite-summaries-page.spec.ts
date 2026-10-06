import {
  suiteSortKey,
  type SuiteSortKey,
  type SuiteSortSource,
  type SuiteSummary,
} from '@qably/types';
import { decodeSuiteSummariesCursor } from './suite-summaries-cursor';
import {
  cutPage,
  matchesFilters,
  toSummaryBase,
  type SuiteSummaryRow,
} from './suite-summaries-page';

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

describe('toSummaryBase', () => {
  it('maps the row columns to the summary fields without status, rate or cases', () => {
    const base = toSummaryBase(
      row({
        id: 'suite-9',
        projectId: 'project-4',
        name: 'Payments',
        description: 'Card and wallet flows',
        tags: ['api', 'smoke'],
        isDefault: true,
        createdAt: new Date('2026-03-07T10:15:30.456Z'),
        _count: { cases: 5 },
      }),
    );

    expect(base).toEqual({
      id: 'suite-9',
      projectId: 'project-4',
      name: 'Payments',
      description: 'Card and wallet flows',
      tags: ['api', 'smoke'],
      isDefault: true,
      createdAt: '2026-03-07T10:15:30.456Z',
      caseCount: 5,
    });
  });

  it.each([
    ['2026-09-24T10:00:00.007Z', 7],
    ['2026-09-24T10:00:00.000Z', 0],
    ['2026-12-31T23:59:59.999Z', 999],
  ])('emits createdAt %s in canonical ISO form', (iso) => {
    expect(toSummaryBase(row({ createdAt: new Date(iso) })).createdAt).toBe(
      iso,
    );
  });

  it('counts every case of the suite from the relation count', () => {
    expect(toSummaryBase(row({ _count: { cases: 5 } })).caseCount).toBe(5);
    expect(toSummaryBase(row({ _count: { cases: 12 } })).caseCount).toBe(12);
  });

  it('reports a suite without cases as zero, not null or missing', () => {
    const base = toSummaryBase(row({ _count: { cases: 0 } }));

    expect(base.caseCount).toBe(0);
    expect(base).toHaveProperty('caseCount', 0);
  });
});

describe('matchesFilters', () => {
  const login = { name: 'Login', description: 'flow', tags: ['api', 'web'] };

  it('keeps every candidate when no filter is set', () => {
    expect(matchesFilters(login, {})).toBe(true);
    expect(matchesFilters(login, { search: undefined, tag: undefined })).toBe(
      true,
    );
  });

  it.each([
    ['name', { name: 'Checkout', description: '' }, 'check', true],
    ['name', { name: 'Checkout', description: '' }, 'cart', false],
    [
      'description',
      { name: 'Billing', description: 'Invoice export' },
      'invoice',
      true,
    ],
    [
      'description',
      { name: 'Billing', description: 'Invoice export' },
      'refund',
      false,
    ],
  ])(
    'matches the search against the %s',
    (_field, candidate, search, expected) => {
      expect(matchesFilters({ ...candidate, tags: [] }, { search })).toBe(
        expected,
      );
    },
  );

  it('ignores the letter case of the search', () => {
    const candidate = { name: 'Auth flow', description: '', tags: [] };

    expect(matchesFilters(candidate, { search: 'AUTH' })).toBe(true);
    expect(matchesFilters(candidate, { search: 'auth FLOW' })).toBe(true);
  });

  it('matches the name or the description on their own and never the two joined', () => {
    expect(matchesFilters(login, { search: 'login' })).toBe(true);
    expect(matchesFilters(login, { search: 'flow' })).toBe(true);
    expect(matchesFilters(login, { search: 'login flow' })).toBe(false);
    expect(matchesFilters(login, { search: 'in fl' })).toBe(false);
  });

  it.each([
    ['100%', 'Pricing 100%', true],
    ['100%', 'Pricing 1000', false],
    ['a_b', 'a_b', true],
    ['a_b', 'axb', false],
    ['C:\\tmp', 'C:\\tmp', true],
    ['C:\\tmp', 'C:/tmp', false],
  ])('treats %p as literal text against %p', (search, name, expected) => {
    expect(
      matchesFilters({ name, description: '', tags: [] }, { search }),
    ).toBe(expected);
  });

  it('filters by exact, case sensitive tag membership', () => {
    const tagged = (tags: string[]) => ({
      name: 'Suite',
      description: '',
      tags,
    });

    expect(matchesFilters(tagged(['api', 'web']), { tag: 'api' })).toBe(true);
    expect(matchesFilters(tagged(['API']), { tag: 'api' })).toBe(false);
    expect(matchesFilters(tagged(['api-v2']), { tag: 'api' })).toBe(false);
    expect(matchesFilters(tagged([]), { tag: 'api' })).toBe(false);
  });

  it('combines search and tag with AND', () => {
    const candidate = { name: 'Checkout', description: '', tags: ['api'] };

    expect(matchesFilters(candidate, { search: 'check', tag: 'api' })).toBe(
      true,
    );
    expect(matchesFilters(candidate, { search: 'cart', tag: 'api' })).toBe(
      false,
    );
    expect(matchesFilters(candidate, { search: 'check', tag: 'web' })).toBe(
      false,
    );
    expect(matchesFilters(candidate, { search: 'cart', tag: 'web' })).toBe(
      false,
    );
  });
});

function at(seconds: number): Date {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
}

function base(id: string, overrides: Partial<SuiteSummaryRow> = {}) {
  return toSummaryBase(row({ id, ...overrides }));
}

function rated(
  id: string,
  recentPassRate: number | null,
  overrides: Partial<SuiteSummaryRow> = {},
): SuiteSummary {
  return {
    ...base(id, overrides),
    status: recentPassRate === null ? 'never-run' : 'pass',
    recentPassRate,
  };
}

function ids(page: readonly { id: string }[]): string[] {
  return page.map((item) => item.id);
}

const byRecent = (item: SuiteSortSource) => suiteSortKey(item, 'recent');
const byName = (item: SuiteSortSource) => suiteSortKey(item, 'name');
const byCases = (item: SuiteSortSource) => suiteSortKey(item, 'cases');
const byPassRate = (item: SuiteSummary) => suiteSortKey(item, 'pass-rate');

function walk<T extends { id: string }>(
  items: readonly T[],
  keyOf: (item: T) => SuiteSortKey,
  limit: number,
): { pages: string[][]; cursors: (string | null)[] } {
  const pages: string[][] = [];
  const cursors: (string | null)[] = [];
  let cursor: SuiteSortKey | undefined;

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const result = cutPage(items, keyOf, { limit, cursor });

    pages.push(ids(result.page));
    cursors.push(result.nextCursor);

    if (result.nextCursor === null) {
      break;
    }

    const decoded = decodeSuiteSummariesCursor(result.nextCursor);
    expect(decoded).not.toBeNull();
    cursor = decoded ?? undefined;
  }

  return { pages, cursors };
}

describe('cutPage ordering', () => {
  it('orders recent by creation time, newest first, with ties by id descending', () => {
    const items = [
      base('a', { createdAt: at(10) }),
      base('b', { createdAt: at(30) }),
      base('c', { createdAt: at(20) }),
      base('d', { createdAt: at(20) }),
    ];

    expect(ids(cutPage(items, byRecent, { limit: 50 }).page)).toEqual([
      'b',
      'd',
      'c',
      'a',
    ]);
  });

  it('places an older default suite by its date and not first', () => {
    const items = [
      base('old-default', { createdAt: at(1), isDefault: true }),
      base('newer', { createdAt: at(2) }),
    ];

    expect(ids(cutPage(items, byRecent, { limit: 50 }).page)).toEqual([
      'newer',
      'old-default',
    ]);
  });

  it('orders by name ignoring case and breaks ties by id ascending', () => {
    const items = [
      base('b', { name: 'beta' }),
      base('a2', { name: 'alpha' }),
      base('g', { name: 'Gamma' }),
      base('a1', { name: 'Alpha' }),
    ];

    expect(ids(cutPage(items, byName, { limit: 50 }).page)).toEqual([
      'a1',
      'a2',
      'b',
      'g',
    ]);
  });

  it('orders by pass rate descending with null last and ties by newest', () => {
    const items = [
      rated('p100-old', 100, { createdAt: at(1) }),
      rated('p50', 50, { createdAt: at(5) }),
      rated('none', null, { createdAt: at(9) }),
      rated('p100-new', 100, { createdAt: at(2) }),
    ];

    expect(ids(cutPage(items, byPassRate, { limit: 50 }).page)).toEqual([
      'p100-new',
      'p100-old',
      'p50',
      'none',
    ]);
  });

  it('orders by case count descending, ties by newest, with empty suites last', () => {
    const items = [
      base('three-old', { createdAt: at(1), _count: { cases: 3 } }),
      base('ten', { createdAt: at(2), _count: { cases: 10 } }),
      base('empty-newest', { createdAt: at(99), _count: { cases: 0 } }),
      base('three-new', { createdAt: at(3), _count: { cases: 3 } }),
    ];

    expect(ids(cutPage(items, byCases, { limit: 50 }).page)).toEqual([
      'ten',
      'three-new',
      'three-old',
      'empty-newest',
    ]);
  });

  it('leaves the input list untouched', () => {
    const items = Object.freeze([
      base('a', { createdAt: at(1) }),
      base('b', { createdAt: at(2) }),
    ]);

    expect(ids(cutPage(items, byRecent, { limit: 50 }).page)).toEqual([
      'b',
      'a',
    ]);
    expect(ids(items)).toEqual(['a', 'b']);
  });
});

describe('cutPage paging', () => {
  const suites = (count: number) =>
    Array.from({ length: count }, (_value, index) =>
      base(`suite-${String(index).padStart(3, '0')}`, {
        createdAt: at(index),
        name: `Suite ${String(index).padStart(3, '0')}`,
        _count: { cases: index % 4 },
      }),
    );

  it('serves 120 suites as pages of 50, 50 and 20 with a cursor only while more remain', () => {
    const { pages, cursors } = walk(suites(120), byRecent, 50);

    expect(pages.map((page) => page.length)).toEqual([50, 50, 20]);
    expect(cursors[0]).not.toBeNull();
    expect(cursors[1]).not.toBeNull();
    expect(cursors[2]).toBeNull();
  });

  it('returns every suite once, in order, across the pages', () => {
    const { pages } = walk(suites(120), byRecent, 50);
    const expected = ids(cutPage(suites(120), byRecent, { limit: 200 }).page);

    expect(pages.flat()).toEqual(expected);
    expect(new Set(pages.flat()).size).toBe(120);
  });

  it('has no cursor when exactly one full page remains', () => {
    const result = cutPage(suites(50), byRecent, { limit: 50 });

    expect(result.page).toHaveLength(50);
    expect(result.nextCursor).toBeNull();
  });

  it('has a cursor with one more suite than the limit and serves it on page two', () => {
    const { pages, cursors } = walk(suites(51), byRecent, 50);

    expect(pages.map((page) => page.length)).toEqual([50, 1]);
    expect(cursors[0]).not.toBeNull();
    expect(cursors[1]).toBeNull();
  });

  it('encodes the sort key of the last suite on the page as the next cursor', () => {
    const items = suites(5);
    const { page, nextCursor } = cutPage(items, byRecent, { limit: 2 });
    const last = page[page.length - 1];

    expect(nextCursor).not.toBeNull();
    expect(decodeSuiteSummariesCursor(nextCursor ?? '')).toEqual(
      byRecent(last),
    );
  });

  it('continues strictly after the cursor and never repeats the suite it points at', () => {
    const items = suites(6);
    const ordered = ids(cutPage(items, byRecent, { limit: 50 }).page);
    const cursor = byRecent(items.find((item) => item.id === ordered[2])!);

    const next = cutPage(items, byRecent, { limit: 2, cursor });

    expect(ids(next.page)).toEqual([ordered[3], ordered[4]]);
  });

  it.each([
    ['recent', byRecent],
    ['name', byName],
    ['cases', byCases],
  ] as const)(
    'walks all suites of sort %s without gaps or repeats when keys tie',
    (_sort, keyOf) => {
      const items = suites(23);
      const full = ids(cutPage(items, keyOf, { limit: 100 }).page);

      const { pages } = walk(items, keyOf, 5);

      expect(pages.map((page) => page.length)).toEqual([5, 5, 5, 5, 3]);
      expect(pages.flat()).toEqual(full);
    },
  );

  it('walks the pass rate order across ties and null rates', () => {
    const items = Array.from({ length: 17 }, (_value, index) =>
      rated(
        `suite-${String(index).padStart(2, '0')}`,
        index % 5 === 0 ? null : (index % 3) * 40,
        { createdAt: at(index % 6) },
      ),
    );
    const full = ids(cutPage(items, byPassRate, { limit: 100 }).page);

    const { pages } = walk(items, byPassRate, 4);

    expect(pages.flat()).toEqual(full);
    expect(new Set(pages.flat()).size).toBe(17);
  });

  it('continues from the position of a cursor whose suite was deleted', () => {
    const items = suites(5);
    const ordered = ids(cutPage(items, byRecent, { limit: 50 }).page);
    const deleted = items.find((item) => item.id === ordered[1])!;
    const cursor = byRecent(deleted);
    const remaining = items.filter((item) => item.id !== deleted.id);

    const next = cutPage(remaining, byRecent, { limit: 50, cursor });

    expect(ids(next.page)).toEqual([ordered[2], ordered[3], ordered[4]]);
    expect(next.nextCursor).toBeNull();
  });

  it('keeps earlier suites unrepeated and unskipped when a newer suite appears between pages', () => {
    const original = suites(6);
    const orderedBefore = ids(cutPage(original, byRecent, { limit: 50 }).page);
    const first = cutPage(original, byRecent, { limit: 3 });
    const cursor = decodeSuiteSummariesCursor(first.nextCursor ?? '');
    expect(cursor).not.toBeNull();

    const withNewest = [...original, base('brand-new', { createdAt: at(500) })];
    const second = cutPage(withNewest, byRecent, {
      limit: 3,
      cursor: cursor ?? undefined,
    });

    expect(ids(first.page)).toEqual(orderedBefore.slice(0, 3));
    expect(ids(second.page)).toEqual(orderedBefore.slice(3));
    expect(ids(second.page)).not.toContain('brand-new');
  });

  it('answers a pass rate cursor that no longer reaches any row with an empty last page', () => {
    const items = [rated('p100', 100), rated('p50', 50)];
    const cursor: SuiteSortKey = {
      sort: 'pass-rate',
      recentPassRate: null,
      createdAt: at(0).toISOString(),
      id: 'gone',
    };

    expect(cutPage(items, byPassRate, { limit: 10, cursor })).toEqual({
      page: [],
      nextCursor: null,
    });
  });

  it('still serves null rated suites that sort after a null rate cursor', () => {
    const items = [
      rated('p100', 100),
      rated('older-null', null, { createdAt: at(1) }),
      rated('newer-null', null, { createdAt: at(8) }),
    ];
    const cursor: SuiteSortKey = {
      sort: 'pass-rate',
      recentPassRate: null,
      createdAt: at(5).toISOString(),
      id: 'gone',
    };

    expect(ids(cutPage(items, byPassRate, { limit: 10, cursor }).page)).toEqual(
      ['older-null'],
    );
  });

  it('treats quotes and comment markers in a cursor value as plain data', () => {
    const items = [base('a', { name: 'Alpha' }), base('z', { name: 'Zeta' })];
    const cursor: SuiteSortKey = {
      sort: 'name',
      name: `x'; DROP TABLE "suite"; --`,
      id: 'gone',
    };

    expect(ids(cutPage(items, byName, { limit: 10, cursor }).page)).toEqual([
      'z',
    ]);
  });

  it('round trips a last name that contains quotes and comment markers', () => {
    const items = [base('a', { name: `a'--b` }), base('c', { name: 'c' })];

    const { pages, cursors } = walk(items, byName, 1);

    expect(pages).toEqual([['a'], ['c']]);
    expect(decodeSuiteSummariesCursor(cursors[0] ?? '')).toEqual({
      sort: 'name',
      name: `a'--b`,
      id: 'a',
    });
  });
});
