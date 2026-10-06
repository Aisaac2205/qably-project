import {
  SUITE_SUMMARY_SELECT,
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
    ...overrides,
  };
}

describe('SUITE_SUMMARY_SELECT', () => {
  it('selects the summary columns and no relation aggregate', () => {
    expect(SUITE_SUMMARY_SELECT).toEqual({
      id: true,
      projectId: true,
      name: true,
      description: true,
      tags: true,
      isDefault: true,
      createdAt: true,
    });
    expect(SUITE_SUMMARY_SELECT).not.toHaveProperty('_count');
  });
});

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
      }),
      new Map([['suite-9', 5]]),
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
    expect(
      toSummaryBase(row({ createdAt: new Date(iso) }), new Map()).createdAt,
    ).toBe(iso);
  });

  it('takes the case count of the suite from the counts map by its id', () => {
    const counts = new Map([
      ['suite-1', 5],
      ['suite-2', 12],
    ]);

    expect(toSummaryBase(row({ id: 'suite-1' }), counts).caseCount).toBe(5);
    expect(toSummaryBase(row({ id: 'suite-2' }), counts).caseCount).toBe(12);
  });

  it('reports a suite absent from the counts map as zero, not null or missing', () => {
    const base = toSummaryBase(
      row({ id: 'suite-3' }),
      new Map([['suite-1', 5]]),
    );

    expect(base.caseCount).toBe(0);
    expect(base).toHaveProperty('caseCount', 0);
  });
});
