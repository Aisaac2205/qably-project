import {
  toSummaryBase,
  type SuiteSummaryRow,
} from './suite-summaries-candidates';

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
