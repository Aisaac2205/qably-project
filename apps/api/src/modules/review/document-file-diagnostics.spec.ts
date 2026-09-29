import {
  MAX_DIAGNOSED_TITLES,
  MAX_LISTED_UNMATCHED_KEYS,
  describeTruncatedSource,
  diagnoseNameCollision,
  findBlockingHolders,
  findDuplicateIncomingTitles,
  formatNameCollisionDiagnosis,
  summarizeUnmatchedTargets,
  type IncomingTitle,
  type MatchedTitle,
  type NameHolder,
} from './document-file-diagnostics';

function incoming(overrides: Partial<IncomingTitle> = {}): IncomingTitle {
  return {
    testCaseId: 'case-1',
    automationKey: 'Cart > adds an item',
    suiteId: 'suite-1',
    title: 'Adds an item to the cart',
    ...overrides,
  };
}

function holder(overrides: Partial<NameHolder> = {}): NameHolder {
  return {
    id: 'case-holder',
    suiteId: 'suite-1',
    name: 'Adds an item to the cart',
    automationKey: 'Cart > holds the name',
    ...overrides,
  };
}

describe('findDuplicateIncomingTitles', () => {
  it('returns nothing when every title in a suite is distinct', () => {
    const duplicates = findDuplicateIncomingTitles([
      incoming({ testCaseId: 'a', title: 'First' }),
      incoming({ testCaseId: 'b', title: 'Second' }),
    ]);

    expect(duplicates).toEqual([]);
  });

  it('groups the cases that share a title in the same suite and lists their automation keys', () => {
    const duplicates = findDuplicateIncomingTitles([
      incoming({ testCaseId: 'a', automationKey: 'k1', title: 'Same' }),
      incoming({ testCaseId: 'b', automationKey: 'k2', title: 'Same' }),
      incoming({ testCaseId: 'c', automationKey: 'k3', title: 'Other' }),
      incoming({ testCaseId: 'd', automationKey: 'k4', title: 'Same' }),
    ]);

    expect(duplicates).toEqual([
      { suiteId: 'suite-1', title: 'Same', automationKeys: ['k1', 'k2', 'k4'] },
    ]);
  });

  it('does not treat the same title in two different suites as a duplicate', () => {
    const duplicates = findDuplicateIncomingTitles([
      incoming({ testCaseId: 'a', suiteId: 'suite-1', title: 'Same' }),
      incoming({ testCaseId: 'b', suiteId: 'suite-2', title: 'Same' }),
    ]);

    expect(duplicates).toEqual([]);
  });

  it('keeps the titles case-sensitive, like the database constraint', () => {
    const duplicates = findDuplicateIncomingTitles([
      incoming({ testCaseId: 'a', title: 'Same' }),
      incoming({ testCaseId: 'b', title: 'same' }),
    ]);

    expect(duplicates).toEqual([]);
  });

  it('reports each duplicated group once, in first-seen order', () => {
    const duplicates = findDuplicateIncomingTitles([
      incoming({ testCaseId: 'a', automationKey: 'k1', title: 'B' }),
      incoming({ testCaseId: 'b', automationKey: 'k2', title: 'A' }),
      incoming({ testCaseId: 'c', automationKey: 'k3', title: 'B' }),
      incoming({ testCaseId: 'd', automationKey: 'k4', title: 'A' }),
    ]);

    expect(duplicates.map((group) => group.title)).toEqual(['B', 'A']);
  });

  it('is not confused by a suite id and title that concatenate to the same text', () => {
    const duplicates = findDuplicateIncomingTitles([
      incoming({ testCaseId: 'a', suiteId: 'ab', title: 'c' }),
      incoming({ testCaseId: 'b', suiteId: 'a', title: 'bc' }),
    ]);

    expect(duplicates).toEqual([]);
  });
});

describe('findBlockingHolders', () => {
  it('returns a case that already holds a title another case is about to take', () => {
    const blocking = findBlockingHolders(
      [holder()],
      [incoming({ testCaseId: 'case-1', title: 'Adds an item to the cart' })],
    );

    expect(blocking).toEqual([
      {
        suiteId: 'suite-1',
        title: 'Adds an item to the cart',
        holderId: 'case-holder',
        holderAutomationKey: 'Cart > holds the name',
      },
    ]);
  });

  it('ignores a case that holds the title only because it is the very case being renamed to it', () => {
    const blocking = findBlockingHolders(
      [holder({ id: 'case-1' })],
      [incoming({ testCaseId: 'case-1', title: 'Adds an item to the cart' })],
    );

    expect(blocking).toEqual([]);
  });

  it('keeps a holder when another incoming case wants its title, even if the holder is itself incoming', () => {
    const blocking = findBlockingHolders(
      [holder({ id: 'case-2', name: 'Shared' })],
      [
        incoming({ testCaseId: 'case-1', title: 'Shared' }),
        incoming({ testCaseId: 'case-2', title: 'Renamed' }),
      ],
    );

    expect(blocking).toHaveLength(1);
    expect(blocking[0].holderId).toBe('case-2');
  });

  it('ignores a holder in a different suite than the incoming title', () => {
    const blocking = findBlockingHolders(
      [holder({ suiteId: 'suite-2' })],
      [incoming({ suiteId: 'suite-1' })],
    );

    expect(blocking).toEqual([]);
  });

  it('carries a missing automation key through as null', () => {
    const blocking = findBlockingHolders(
      [holder({ automationKey: null })],
      [incoming()],
    );

    expect(blocking[0].holderAutomationKey).toBeNull();
  });
});

describe('formatNameCollisionDiagnosis', () => {
  it('names the file, the unique constraint, the repeated titles with their keys and the holders', () => {
    const message = formatNameCollisionDiagnosis(
      'src/cart.spec.ts',
      [{ suiteId: 'suite-1', title: 'Same', automationKeys: ['k1', 'k2'] }],
      [
        {
          suiteId: 'suite-1',
          title: 'Taken',
          holderId: 'case-9',
          holderAutomationKey: 'kX',
        },
      ],
    );

    expect(message).toBe(
      'Persisting the documentation for src/cart.spec.ts hit the unique (suiteId, name) constraint. ' +
        'Incoming titles repeated within the job: "Same" in suite suite-1 (keys "k1", "k2"). ' +
        'Incoming titles already held by another case: "Taken" in suite suite-1 is held by case case-9 (key "kX").',
    );
  });

  it('says none for a section with nothing to report', () => {
    const message = formatNameCollisionDiagnosis('src/cart.spec.ts', [], []);

    expect(message).toBe(
      'Persisting the documentation for src/cart.spec.ts hit the unique (suiteId, name) constraint. ' +
        'Incoming titles repeated within the job: none. ' +
        'Incoming titles already held by another case: none.',
    );
  });

  it('shows a holder without an automation key as key none', () => {
    const message = formatNameCollisionDiagnosis(
      'src/cart.spec.ts',
      [],
      [
        {
          suiteId: 'suite-1',
          title: 'Taken',
          holderId: 'case-9',
          holderAutomationKey: null,
        },
      ],
    );

    expect(message).toContain('is held by case case-9 (key none)');
  });

  it('escapes titles so a newline or a quote cannot forge a log line', () => {
    const message = formatNameCollisionDiagnosis(
      'src/cart.spec.ts',
      [
        {
          suiteId: 'suite-1',
          title: 'Bad"\nERROR forged',
          automationKeys: ['k1', 'k2'],
        },
      ],
      [],
    );

    expect(message).not.toContain('\n');
    expect(message).toContain('"Bad\\"\\nERROR forged"');
  });
});

describe('summarizeUnmatchedTargets', () => {
  const base = {
    filePath: 'src/cart.spec.ts',
    matched: 87,
    total: 113,
    sourceLength: 60_000,
    truncated: true,
  };

  it('reports the matched of total counts, every key when few, the source length and the truncation', () => {
    const message = summarizeUnmatchedTargets({
      ...base,
      matched: 1,
      total: 3,
      unmatchedKeys: ['Cart > a', 'Cart > b'],
    });

    expect(message).toBe(
      'Matched 1 of 3 target(s) in src/cart.spec.ts; 2 unmatched: "Cart > a", "Cart > b"; source length 60000 characters, truncated',
    );
  });

  it('lists only the first keys and counts the rest', () => {
    const keys = Array.from({ length: 26 }, (_, index) => `key-${index}`);

    const message = summarizeUnmatchedTargets({
      ...base,
      unmatchedKeys: keys,
    });

    expect(MAX_LISTED_UNMATCHED_KEYS).toBe(10);
    expect(message).toContain('26 unmatched:');
    expect(message).toContain('"key-0"');
    expect(message).toContain('"key-9"');
    expect(message).not.toContain('"key-10"');
    expect(message).toContain('(+16 more)');
  });

  it('adds no "more" marker when every key fits', () => {
    const keys = Array.from(
      { length: MAX_LISTED_UNMATCHED_KEYS },
      (_, index) => `key-${index}`,
    );

    const message = summarizeUnmatchedTargets({
      ...base,
      unmatchedKeys: keys,
    });

    expect(message).not.toContain('more');
  });

  it('says not truncated when the whole file was read', () => {
    const message = summarizeUnmatchedTargets({
      ...base,
      sourceLength: 4_200,
      truncated: false,
      unmatchedKeys: ['Cart > a'],
    });

    expect(message).toContain('source length 4200 characters, not truncated');
  });

  it('escapes the keys so a newline cannot forge a log line', () => {
    const message = summarizeUnmatchedTargets({
      ...base,
      unmatchedKeys: ['a\nERROR forged'],
    });

    expect(message).not.toContain('\n');
  });
});

describe('describeTruncatedSource', () => {
  it('names the file, the cut length and the consequence', () => {
    expect(describeTruncatedSource('src/cart.spec.ts', 60_000)).toBe(
      'Source for src/cart.spec.ts was cut at 60000 characters: cases located after the cut cannot be documented',
    );
  });
});

describe('diagnoseNameCollision', () => {
  interface FakeTestCaseTable {
    findMany: jest.Mock;
  }

  function fakePrisma(findMany: jest.Mock): { testCase: FakeTestCaseTable } {
    return { testCase: { findMany } };
  }

  function matched(
    entries: { id: string; key: string; title: string }[],
  ): MatchedTitle[] {
    return entries.map((entry) => ({
      target: { testCaseId: entry.id, automationKey: entry.key },
      testCase: { title: entry.title },
    }));
  }

  it('reports both the titles repeated inside the job and the titles held by another case', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'a', suiteId: 'suite-1' },
        { id: 'b', suiteId: 'suite-1' },
        { id: 'c', suiteId: 'suite-1' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'case-9',
          suiteId: 'suite-1',
          name: 'Taken',
          automationKey: 'kX',
        },
      ]);

    const message = await diagnoseNameCollision(
      fakePrisma(findMany) as never,
      'src/cart.spec.ts',
      matched([
        { id: 'a', key: 'k1', title: 'Same' },
        { id: 'b', key: 'k2', title: 'Same' },
        { id: 'c', key: 'k3', title: 'Taken' },
      ]),
    );

    expect(message).toContain(
      'Incoming titles repeated within the job: "Same" in suite suite-1 (keys "k1", "k2")',
    );
    expect(message).toContain(
      'Incoming titles already held by another case: "Taken" in suite suite-1 is held by case case-9 (key "kX")',
    );
  });

  it('reads the suite of the matched cases, then looks for holders of the incoming titles in those suites only', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'a', suiteId: 'suite-1' },
        { id: 'b', suiteId: 'suite-2' },
      ])
      .mockResolvedValueOnce([]);

    await diagnoseNameCollision(
      fakePrisma(findMany) as never,
      'src/cart.spec.ts',
      matched([
        { id: 'a', key: 'k1', title: 'One' },
        { id: 'b', key: 'k2', title: 'Two' },
      ]),
    );

    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ['a', 'b'] } },
      select: { id: true, suiteId: true },
    });
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: {
        OR: [
          { suiteId: 'suite-1', name: { in: ['One'] } },
          { suiteId: 'suite-2', name: { in: ['Two'] } },
        ],
      },
      select: { id: true, suiteId: true, name: true, automationKey: true },
    });
  });

  it('bounds the holder lookup to the first titles of the job', async () => {
    const entries = Array.from(
      { length: MAX_DIAGNOSED_TITLES + 5 },
      (_, index) => ({
        id: `case-${index}`,
        key: `key-${index}`,
        title: `Title ${index}`,
      }),
    );
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(
        entries.map((entry) => ({ id: entry.id, suiteId: 'suite-1' })),
      )
      .mockResolvedValueOnce([]);

    await diagnoseNameCollision(
      fakePrisma(findMany) as never,
      'src/cart.spec.ts',
      matched(entries),
    );

    const lookup = (findMany.mock.calls as [unknown][])[1][0] as {
      where: { OR: { name: { in: string[] } }[] };
    };
    const lookedUp = lookup.where.OR.flatMap((clause) => clause.name.in);
    expect(lookedUp).toHaveLength(MAX_DIAGNOSED_TITLES);
    expect(lookedUp).toEqual(
      entries.slice(0, MAX_DIAGNOSED_TITLES).map((entry) => entry.title),
    );
  });

  it('skips the holder lookup when no matched case can be resolved to a suite', async () => {
    const findMany = jest.fn().mockResolvedValueOnce([]);

    const message = await diagnoseNameCollision(
      fakePrisma(findMany) as never,
      'src/cart.spec.ts',
      matched([{ id: 'a', key: 'k1', title: 'One' }]),
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(message).toContain(
      'Incoming titles already held by another case: none',
    );
  });

  it('never throws when the lookup itself fails, and says so in the message', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('connection lost'));

    const message = await diagnoseNameCollision(
      fakePrisma(findMany) as never,
      'src/cart.spec.ts',
      matched([{ id: 'a', key: 'k1', title: 'One' }]),
    );

    expect(message).toBe(
      'Persisting the documentation for src/cart.spec.ts hit the unique (suiteId, name) constraint, and the diagnosis lookup failed',
    );
  });
});
