import { describe, it, expect, expectTypeOf } from 'vitest';
import type { SuiteRunStatus } from './index';
import {
  SUITE_RUN_STATUSES,
  SUITE_SUMMARY_SORTS,
  collectSuiteTags,
  compareSuiteSortKeys,
  matchesSuiteSearch,
  suiteSortKey,
  type SuiteSortKey,
  type SuiteSummariesPage,
  type SuiteSummary,
  type SuiteSummarySort,
  type SuiteTagsFacet,
} from './suite-summaries';

function summary(overrides: Partial<SuiteSummary> = {}): SuiteSummary {
  return {
    id: 'suite-a',
    projectId: 'project-1',
    name: 'Checkout',
    description: '',
    tags: [],
    isDefault: false,
    createdAt: '2026-03-01T10:00:00.000Z',
    caseCount: 0,
    status: 'never-run',
    recentPassRate: null,
    ...overrides,
  };
}

function orderedIds(items: readonly SuiteSummary[], sort: SuiteSummarySort): string[] {
  return [...items]
    .sort((a, b) => compareSuiteSortKeys(suiteSortKey(a, sort), suiteSortKey(b, sort)))
    .map((item) => item.id);
}

type Unresolved = Pick<SuiteSummary, 'id' | 'name' | 'createdAt' | 'caseCount'>;
type Resolved = Unresolved & Pick<SuiteSummary, 'recentPassRate'>;
type AcceptsArguments<Args extends unknown[]> = typeof suiteSortKey extends (
  ...args: Args
) => unknown
  ? true
  : false;

const T1 = '2026-03-01T10:00:00.000Z';
const T2 = '2026-03-02T10:00:00.000Z';
const T3 = '2026-03-03T10:00:00.000Z';

describe('suite summary contract constants', () => {
  it('lists the four sorts in the documented order', () => {
    expect([...SUITE_SUMMARY_SORTS]).toEqual(['recent', 'name', 'pass-rate', 'cases']);
  });

  it('lists every derived suite run status', () => {
    const expected: SuiteRunStatus[] = ['running', 'pass', 'fail', 'needs-attention', 'never-run'];

    expect([...SUITE_RUN_STATUSES].sort()).toEqual([...expected].sort());
  });

  it('covers every suite run status at the type level', () => {
    expectTypeOf<(typeof SUITE_RUN_STATUSES)[number]>().toEqualTypeOf<SuiteRunStatus>();
  });

  it('keeps cases and the run content out of the summary type', () => {
    expectTypeOf<keyof SuiteSummary>().toEqualTypeOf<
      | 'id'
      | 'projectId'
      | 'name'
      | 'description'
      | 'tags'
      | 'isDefault'
      | 'createdAt'
      | 'caseCount'
      | 'status'
      | 'recentPassRate'
    >();
    expectTypeOf<SuiteSummariesPage>().toEqualTypeOf<{
      items: SuiteSummary[];
      nextCursor: string | null;
    }>();
    expectTypeOf<SuiteTagsFacet>().toEqualTypeOf<{ items: string[] }>();
  });
});

describe('suiteSortKey', () => {
  const source = summary({
    id: 'suite-9',
    name: 'Payments',
    createdAt: T2,
    caseCount: 4,
    recentPassRate: 80,
  });

  it('keys recent by creation time and id only', () => {
    expect(suiteSortKey(source, 'recent')).toEqual({ sort: 'recent', createdAt: T2, id: 'suite-9' });
  });

  it('keys name by the name and id only', () => {
    expect(suiteSortKey(source, 'name')).toEqual({ sort: 'name', name: 'Payments', id: 'suite-9' });
  });

  it('keys pass-rate by the rate, then creation time and id', () => {
    expect(suiteSortKey(source, 'pass-rate')).toEqual({
      sort: 'pass-rate',
      recentPassRate: 80,
      createdAt: T2,
      id: 'suite-9',
    });
  });

  it('keys cases by the case count, then creation time and id', () => {
    expect(suiteSortKey(source, 'cases')).toEqual({
      sort: 'cases',
      caseCount: 4,
      createdAt: T2,
      id: 'suite-9',
    });
  });

  it('keys a source without the pass rate for the sorts that do not read it', () => {
    const unresolved = { id: 'suite-9', name: 'Payments', createdAt: T2, caseCount: 4 };

    expect(suiteSortKey(unresolved, 'cases')).toEqual({
      sort: 'cases',
      caseCount: 4,
      createdAt: T2,
      id: 'suite-9',
    });
  });

  it('accepts a source without the pass rate only for the sorts that do not read it', () => {
    expectTypeOf<AcceptsArguments<[Unresolved, 'recent']>>().toEqualTypeOf<true>();
    expectTypeOf<AcceptsArguments<[Unresolved, 'name']>>().toEqualTypeOf<true>();
    expectTypeOf<AcceptsArguments<[Unresolved, 'cases']>>().toEqualTypeOf<true>();
    expectTypeOf<AcceptsArguments<[Unresolved, 'pass-rate']>>().toEqualTypeOf<false>();
  });

  it('requires the pass rate when the sort is pass-rate or only known at run time', () => {
    expectTypeOf<AcceptsArguments<[Resolved, 'pass-rate']>>().toEqualTypeOf<true>();
    expectTypeOf<AcceptsArguments<[Resolved, SuiteSummarySort]>>().toEqualTypeOf<true>();
    expectTypeOf<AcceptsArguments<[Unresolved, SuiteSummarySort]>>().toEqualTypeOf<false>();
  });
});

describe('compareSuiteSortKeys recent', () => {
  it('orders by creation time, newest first', () => {
    const items = [
      summary({ id: 'a', createdAt: T1 }),
      summary({ id: 'b', createdAt: T3 }),
      summary({ id: 'c', createdAt: T2 }),
    ];

    expect(orderedIds(items, 'recent')).toEqual(['b', 'c', 'a']);
  });

  it('breaks a creation time tie by id, highest first', () => {
    const items = [
      summary({ id: 'suite-a', createdAt: T1 }),
      summary({ id: 'suite-c', createdAt: T1 }),
      summary({ id: 'suite-b', createdAt: T1 }),
    ];

    expect(orderedIds(items, 'recent')).toEqual(['suite-c', 'suite-b', 'suite-a']);
  });

  it('places an older default suite by its date, not first', () => {
    const items = [
      summary({ id: 'default', createdAt: T1, isDefault: true }),
      summary({ id: 'newer', createdAt: T3 }),
      summary({ id: 'middle', createdAt: T2 }),
    ];

    expect(orderedIds(items, 'recent')).toEqual(['newer', 'middle', 'default']);
  });

  it('compares timestamps as instants, not as text, when one has no milliseconds', () => {
    const items = [
      summary({ id: 'whole-second', createdAt: '2026-03-01T10:00:00Z' }),
      summary({ id: 'half-second-later', createdAt: '2026-03-01T10:00:00.500Z' }),
    ];

    expect(orderedIds(items, 'recent')).toEqual(['half-second-later', 'whole-second']);
  });

  it('reports equal keys as a tie', () => {
    const key = suiteSortKey(summary({ id: 'x', createdAt: T1 }), 'recent');

    expect(compareSuiteSortKeys(key, key)).toBe(0);
  });

  it('is antisymmetric: swapping the arguments flips the sign', () => {
    const older = suiteSortKey(summary({ id: 'x', createdAt: T1 }), 'recent');
    const newer = suiteSortKey(summary({ id: 'y', createdAt: T2 }), 'recent');

    expect(compareSuiteSortKeys(newer, older)).toBeLessThan(0);
    expect(compareSuiteSortKeys(older, newer)).toBeGreaterThan(0);
  });
});

describe('compareSuiteSortKeys name', () => {
  it('orders without regard to case and breaks name ties by id ascending', () => {
    const items = [
      summary({ id: 'b1', name: 'beta' }),
      summary({ id: 'a2', name: 'alpha' }),
      summary({ id: 'a1', name: 'Alpha' }),
      summary({ id: 'g1', name: 'Gamma' }),
    ];

    expect(orderedIds(items, 'name')).toEqual(['a1', 'a2', 'b1', 'g1']);
  });

  it('keeps a letter with a diacritic next to its base letter', () => {
    const items = [
      summary({ id: 'z', name: 'Zeta' }),
      summary({ id: 'beta', name: 'Beta' }),
      summary({ id: 'accented', name: 'Ábaco' }),
      summary({ id: 'plain', name: 'Abeja' }),
    ];

    expect(orderedIds(items, 'name')).toEqual(['accented', 'plain', 'beta', 'z']);
  });

  it('treats a letter and its accented form as equal and falls back to the id', () => {
    const items = [
      summary({ id: 'second', name: 'arbol' }),
      summary({ id: 'first', name: 'Árbol' }),
    ];

    expect(orderedIds(items, 'name')).toEqual(['first', 'second']);
  });

  it('keeps the n with a tilde beside the n and ahead of the o', () => {
    const items = [
      summary({ id: 'o', name: 'oso' }),
      summary({ id: 'tilde', name: 'ñandú' }),
      summary({ id: 'n', name: 'nada' }),
    ];

    expect(orderedIds(items, 'name')).toEqual(['n', 'tilde', 'o']);
  });
});

describe('compareSuiteSortKeys pass-rate', () => {
  it('orders by rate descending with null last and breaks ties by newest creation time', () => {
    const items = [
      summary({ id: 'hundred-old', recentPassRate: 100, createdAt: T1 }),
      summary({ id: 'fifty', recentPassRate: 50, createdAt: T1 }),
      summary({ id: 'never', recentPassRate: null, createdAt: T1 }),
      summary({ id: 'hundred-new', recentPassRate: 100, createdAt: T2 }),
    ];

    expect(orderedIds(items, 'pass-rate')).toEqual([
      'hundred-new',
      'hundred-old',
      'fifty',
      'never',
    ]);
  });

  it('orders a zero rate ahead of null', () => {
    const items = [
      summary({ id: 'null-rate', recentPassRate: null, createdAt: T3 }),
      summary({ id: 'zero-rate', recentPassRate: 0, createdAt: T1 }),
    ];

    expect(orderedIds(items, 'pass-rate')).toEqual(['zero-rate', 'null-rate']);
  });

  it('breaks a full tie of equal non-null rates and creation times by id, highest first', () => {
    const items = [
      summary({ id: 'suite-a', recentPassRate: 80, createdAt: T1 }),
      summary({ id: 'suite-c', recentPassRate: 80, createdAt: T1 }),
      summary({ id: 'suite-b', recentPassRate: 80, createdAt: T1 }),
    ];

    expect(orderedIds(items, 'pass-rate')).toEqual(['suite-c', 'suite-b', 'suite-a']);
  });

  it('orders a group of null rates by creation time and then by id, both newest first', () => {
    const items = [
      summary({ id: 'suite-a', recentPassRate: null, createdAt: T1 }),
      summary({ id: 'suite-b', recentPassRate: null, createdAt: T2 }),
      summary({ id: 'suite-c', recentPassRate: null, createdAt: T2 }),
    ];

    expect(orderedIds(items, 'pass-rate')).toEqual(['suite-c', 'suite-b', 'suite-a']);
  });
});

describe('compareSuiteSortKeys cases', () => {
  it('orders by case count descending and breaks ties by newest creation time', () => {
    const items = [
      summary({ id: 'three-old', caseCount: 3, createdAt: T1 }),
      summary({ id: 'ten', caseCount: 10, createdAt: T1 }),
      summary({ id: 'zero', caseCount: 0, createdAt: T1 }),
      summary({ id: 'three-new', caseCount: 3, createdAt: T2 }),
    ];

    expect(orderedIds(items, 'cases')).toEqual(['ten', 'three-new', 'three-old', 'zero']);
  });

  it('breaks a full tie by id, highest first', () => {
    const items = [
      summary({ id: 'suite-a', caseCount: 2, createdAt: T1 }),
      summary({ id: 'suite-b', caseCount: 2, createdAt: T1 }),
    ];

    expect(orderedIds(items, 'cases')).toEqual(['suite-b', 'suite-a']);
  });
});

describe('compareSuiteSortKeys across sorts', () => {
  it('refuses to compare keys that belong to different sorts', () => {
    const recent: SuiteSortKey = { sort: 'recent', createdAt: T1, id: 'x' };
    const name: SuiteSortKey = { sort: 'name', name: 'x', id: 'x' };

    expect(() => compareSuiteSortKeys(recent, name)).toThrow();
  });
});

describe('matchesSuiteSearch', () => {
  const login = { name: 'Login', description: 'flow' };

  it('matches a substring of the name without regard to case', () => {
    expect(matchesSuiteSearch(login, 'LOG')).toBe(true);
  });

  it('matches a substring of the description on its own', () => {
    expect(matchesSuiteSearch(login, 'flow')).toBe(true);
  });

  it('does not join name and description into one string', () => {
    expect(matchesSuiteSearch(login, 'login flow')).toBe(false);
  });

  it('rejects text that appears in neither field', () => {
    expect(matchesSuiteSearch(login, 'checkout')).toBe(false);
  });

  it('trims the search before matching', () => {
    expect(matchesSuiteSearch({ name: 'Checkout', description: '' }, '  Checkout  ')).toBe(true);
  });

  it('matches everything when the search is blank', () => {
    expect(matchesSuiteSearch(login, '   ')).toBe(true);
  });

  it('treats the percent sign as a literal character', () => {
    const percent = { name: 'Pricing 100%', description: '' };
    const digits = { name: 'Pricing 1000', description: '' };

    expect(matchesSuiteSearch(percent, '100%')).toBe(true);
    expect(matchesSuiteSearch(digits, '100%')).toBe(false);
  });

  it('treats the underscore as a literal character, not a wildcard', () => {
    expect(matchesSuiteSearch({ name: 'a_b', description: '' }, 'a_b')).toBe(true);
    expect(matchesSuiteSearch({ name: 'axb', description: '' }, 'a_b')).toBe(false);
  });

  it('treats the backslash as a literal character', () => {
    expect(matchesSuiteSearch({ name: 'C:\\tmp', description: '' }, 'C:\\tmp')).toBe(true);
    expect(matchesSuiteSearch({ name: 'C:tmp', description: '' }, 'C:\\tmp')).toBe(false);
  });

  it('folds the case of non-ASCII letters in both directions', () => {
    expect(matchesSuiteSearch({ name: 'árbol', description: '' }, 'ÁRBOL')).toBe(true);
    expect(matchesSuiteSearch({ name: 'ÁRBOL', description: '' }, 'árbol')).toBe(true);
  });
});

describe('collectSuiteTags', () => {
  it('returns the distinct tags sorted by code unit, uppercase before lowercase', () => {
    expect(collectSuiteTags([['b', 'a'], ['b', 'C'], []])).toEqual(['C', 'a', 'b']);
  });

  it('removes duplicates across suites', () => {
    expect(collectSuiteTags([['api'], ['api', 'ui'], ['ui']])).toEqual(['api', 'ui']);
  });

  it('returns an empty list when no suite has tags', () => {
    expect(collectSuiteTags([[], []])).toEqual([]);
  });

  it('does not mutate the lists it receives', () => {
    const lists = [['b', 'a']];

    collectSuiteTags(lists);

    expect(lists).toEqual([['b', 'a']]);
  });
});
