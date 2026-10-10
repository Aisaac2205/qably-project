import {
  buildCatalogSnapshot,
  parseCatalogSnapshot,
  resolveExecutedCatalog,
  toCatalogColumns,
  type CatalogCaseContent,
  type PreviousRunCaseCatalog,
} from './catalog-snapshot';

function content(
  overrides: Partial<CatalogCaseContent> = {},
): CatalogCaseContent {
  return {
    name: 'Valid login redirects to dashboard',
    steps: ['Open /login', 'Submit valid credentials'],
    expectedResult: 'The dashboard is shown',
    currentVersionId: 'version-3',
    currentVersion: { version: 3 },
    ...overrides,
  };
}

const validSnapshot = {
  name: 'Valid login redirects to dashboard',
  steps: ['Open /login', 'Submit valid credentials'],
  expectedResult: 'The dashboard is shown',
  version: 3,
};

describe('buildCatalogSnapshot', () => {
  it('copies the executed content and the version number in force', () => {
    expect(buildCatalogSnapshot(content())).toEqual(validSnapshot);
  });

  it('records a null version for a case that has never been approved', () => {
    const snapshot = buildCatalogSnapshot(
      content({ currentVersionId: null, currentVersion: null }),
    );

    expect(snapshot.version).toBeNull();
    expect(snapshot.name).toBe('Valid login redirects to dashboard');
  });

  it('keeps an undocumented case as empty steps and an empty expected result', () => {
    const snapshot = buildCatalogSnapshot(
      content({ steps: [], expectedResult: '' }),
    );

    expect(snapshot.steps).toEqual([]);
    expect(snapshot.expectedResult).toBe('');
  });

  it('detaches the steps from the catalog row so a later mutation cannot rewrite the snapshot', () => {
    const row = content();
    const snapshot = buildCatalogSnapshot(row);

    row.steps.push('A step added after the run');

    expect(snapshot.steps).toEqual(['Open /login', 'Submit valid credentials']);
  });

  it('produces a value the parser accepts unchanged', () => {
    const snapshot = buildCatalogSnapshot(content());

    expect(parseCatalogSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    );
  });
});

describe('parseCatalogSnapshot', () => {
  it('returns a well-formed snapshot', () => {
    expect(parseCatalogSnapshot(validSnapshot)).toEqual(validSnapshot);
  });

  it('accepts a null version, which is how a draft case is recorded', () => {
    expect(parseCatalogSnapshot({ ...validSnapshot, version: null })).toEqual({
      ...validSnapshot,
      version: null,
    });
  });

  it('accepts empty steps and an empty expected result', () => {
    const undocumented = { ...validSnapshot, steps: [], expectedResult: '' };

    expect(parseCatalogSnapshot(undocumented)).toEqual(undocumented);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'snapshot'],
    ['a number', 7],
    ['a boolean', true],
    ['an array', [validSnapshot]],
    ['an empty object', {}],
  ])('returns null for %s', (_label, value) => {
    expect(parseCatalogSnapshot(value)).toBeNull();
  });

  it.each([
    ['name', { name: 42 }],
    ['name (missing)', { name: undefined }],
    ['steps (not an array)', { steps: 'Open /login' }],
    ['steps (non-string item)', { steps: ['Open /login', 2] }],
    ['steps (null item)', { steps: [null] }],
    ['steps (missing)', { steps: undefined }],
    ['expectedResult', { expectedResult: ['The dashboard is shown'] }],
    ['expectedResult (missing)', { expectedResult: undefined }],
    ['version (string)', { version: '3' }],
    ['version (fraction)', { version: 1.5 }],
    ['version (zero)', { version: 0 }],
    ['version (negative)', { version: -1 }],
    ['version (NaN)', { version: Number.NaN }],
    ['version (missing)', { version: undefined }],
  ])('returns null when %s is malformed', (_label, patch) => {
    expect(parseCatalogSnapshot({ ...validSnapshot, ...patch })).toBeNull();
  });

  it('drops unknown fields instead of echoing them back', () => {
    const parsed = parseCatalogSnapshot({
      ...validSnapshot,
      extra: 'ignored',
      objective: 'not part of the snapshot',
    });

    expect(parsed).toEqual(validSnapshot);
    expect(parsed).not.toHaveProperty('extra');
  });

  it('never throws on a hostile value', () => {
    const hostile = {
      get name(): string {
        throw new Error('getter exploded');
      },
    };

    expect(() => parseCatalogSnapshot(hostile)).not.toThrow();
    expect(parseCatalogSnapshot(hostile)).toBeNull();
  });
});

function previousRow(
  overrides: Partial<PreviousRunCaseCatalog> = {},
): PreviousRunCaseCatalog {
  return {
    testCaseId: 'case-1',
    testCaseVersionId: 'version-1',
    catalogSnapshot: {
      name: 'Title when first reported',
      steps: ['Original step'],
      expectedResult: 'Original result',
      version: 1,
    },
    ...overrides,
  };
}

describe('resolveExecutedCatalog', () => {
  const current = new Map<string, CatalogCaseContent>([
    ['case-1', content({ name: 'Edited title' })],
    [
      'case-2',
      content({
        name: 'Draft case',
        currentVersionId: null,
        currentVersion: null,
      }),
    ],
  ]);

  it('snapshots the current catalog content with the version in force for a first report', () => {
    const executed = resolveExecutedCatalog(current, []);

    expect(executed.get('case-1')).toEqual({
      testCaseVersionId: 'version-3',
      snapshot: { ...validSnapshot, name: 'Edited title' },
    });
  });

  it('snapshots a draft with no version id and a null version', () => {
    const executed = resolveExecutedCatalog(current, []);

    expect(executed.get('case-2')).toEqual({
      testCaseVersionId: null,
      snapshot: expect.objectContaining({
        name: 'Draft case',
        version: null,
      }) as unknown,
    });
  });

  it('reuses the previous snapshot and version id for a case that was already recorded', () => {
    const executed = resolveExecutedCatalog(current, [previousRow()]);

    expect(executed.get('case-1')).toEqual({
      testCaseVersionId: 'version-1',
      snapshot: {
        name: 'Title when first reported',
        steps: ['Original step'],
        expectedResult: 'Original result',
        version: 1,
      },
    });
  });

  it('keeps using current content for a case the previous report did not record', () => {
    const executed = resolveExecutedCatalog(current, [previousRow()]);

    expect(executed.get('case-2')?.snapshot.name).toBe('Draft case');
  });

  it('lets the first previous row win when a case repeats', () => {
    const executed = resolveExecutedCatalog(current, [
      previousRow({ testCaseVersionId: 'version-first' }),
      previousRow({
        testCaseVersionId: 'version-second',
        catalogSnapshot: { ...validSnapshot, name: 'Second row' },
      }),
    ]);

    expect(executed.get('case-1')?.testCaseVersionId).toBe('version-first');
    expect(executed.get('case-1')?.snapshot.name).toBe(
      'Title when first reported',
    );
  });

  it.each([
    ['no snapshot (a row from before snapshots existed)', null],
    ['a malformed snapshot', { name: 7 }],
  ])(
    'falls back to current content when the previous row has %s',
    (_label, snapshot) => {
      const executed = resolveExecutedCatalog(current, [
        previousRow({ catalogSnapshot: snapshot, testCaseVersionId: null }),
      ]);

      expect(executed.get('case-1')).toEqual({
        testCaseVersionId: 'version-3',
        snapshot: { ...validSnapshot, name: 'Edited title' },
      });
    },
  );

  it('skips a previous row that is a malformed one and uses the next valid snapshot of the same case', () => {
    const executed = resolveExecutedCatalog(current, [
      previousRow({ catalogSnapshot: 'broken', testCaseVersionId: null }),
      previousRow({ testCaseVersionId: 'version-valid' }),
    ]);

    expect(executed.get('case-1')?.testCaseVersionId).toBe('version-valid');
  });

  it('ignores previous rows that were not linked to a catalog case', () => {
    const executed = resolveExecutedCatalog(new Map(), [
      previousRow({ testCaseId: null }),
    ]);

    expect(executed.size).toBe(0);
  });
});

describe('toCatalogColumns', () => {
  it('writes the version id and the snapshot of an executed case', () => {
    expect(
      toCatalogColumns({
        testCaseVersionId: 'version-3',
        snapshot: validSnapshot,
      }),
    ).toEqual({
      testCaseVersionId: 'version-3',
      catalogSnapshot: validSnapshot,
    });
  });

  it('writes a null version id next to the snapshot of a case with no version', () => {
    expect(
      toCatalogColumns({ testCaseVersionId: null, snapshot: validSnapshot }),
    ).toEqual({ testCaseVersionId: null, catalogSnapshot: validSnapshot });
  });

  it('leaves the snapshot key out when there is nothing to record', () => {
    const columns = toCatalogColumns(undefined);

    expect(columns).toEqual({ testCaseVersionId: null });
    expect(columns).not.toHaveProperty('catalogSnapshot');
  });
});
