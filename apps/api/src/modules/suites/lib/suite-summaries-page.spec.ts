import {
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
