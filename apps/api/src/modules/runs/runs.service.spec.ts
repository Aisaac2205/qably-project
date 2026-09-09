import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { deriveRunStatus } from './lib/derive-run-status';
import type { IngestRunInput } from './runs.schemas';
import { RunsService } from './runs.service';

const apiKey: ApiKeyIdentity = {
  apiKeyId: 'key-1',
  projectId: 'project-1',
  organizationId: 'org-1',
};

const suiteRow = { id: 'suite-1', name: 'Checkout' };

const officialCases = [
  { id: 'case-1', name: 'Adds to cart', automationKey: 'Adds to cart' },
];

const runRow = {
  id: 'run-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  suiteId: 'suite-1',
  name: 'Checkout regression',
  status: 'pass' as const,
  source: 'api' as const,
  externalId: 'ci-run-42',
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  finishedAt: null,
  executedById: null,
  commitSha: null,
  commitMessage: null,
  commitAuthor: null,
};

function caseRow(overrides: Record<string, unknown>) {
  return {
    id: 'run-case-1',
    testCaseId: null,
    name: 'Adds to cart',
    suiteName: 'Checkout',
    steps: [],
    expectedResult: '',
    status: 'pass' as const,
    position: 0,
    recordedAt: null,
    ...overrides,
  };
}

interface FakePrisma {
  suite: {
    findFirst: jest.Mock;
    create: jest.Mock;
    findFirstOrThrow: jest.Mock;
    update: jest.Mock;
  };
  testCase: {
    findMany: jest.Mock;
    createMany: jest.Mock;
    update: jest.Mock;
  };
  run: { upsert: jest.Mock };
  runCase: {
    deleteMany: jest.Mock;
    createManyAndReturn: jest.Mock;
    findMany: jest.Mock;
  };
  txRunCaseFindMany: jest.Mock;
  $transaction: jest.Mock;
}

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    suite: {
      findFirst: jest.fn().mockResolvedValue(suiteRow),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: { name: string } }) =>
          Promise.resolve({ id: 'suite-adopted', name: data.name }),
        ),
      findFirstOrThrow: jest.fn().mockResolvedValue(suiteRow),
      update: jest.fn().mockResolvedValue(suiteRow),
    },
    testCase: {
      findMany: jest.fn().mockResolvedValue(officialCases),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
    run: { upsert: jest.fn().mockResolvedValue(runRow) },
    runCase: {
      deleteMany: jest.fn(),
      createManyAndReturn: jest.fn().mockResolvedValue([caseRow({})]),
      findMany: jest.fn().mockResolvedValue([caseRow({})]),
    },
    txRunCaseFindMany: jest.fn().mockResolvedValue([caseRow({})]),
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation((run: (tx: unknown) => unknown) =>
    run({
      suite: prisma.suite,
      testCase: prisma.testCase,
      run: prisma.run,
      runCase: {
        deleteMany: prisma.runCase.deleteMany,
        createManyAndReturn: prisma.runCase.createManyAndReturn,
        findMany: prisma.txRunCaseFindMany,
      },
    }),
  );

  return prisma;
}

function createNotifications() {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

function build(
  prisma: FakePrisma,
  notifications: { publish: jest.Mock } = createNotifications(),
) {
  return new RunsService(prisma as never, notifications as never);
}

const baseInput: IngestRunInput = {
  externalId: 'ci-run-42',
  source: 'api',
  suiteId: 'suite-1',
  name: 'Checkout regression',
  cases: [
    { name: 'Adds to cart', steps: [], expectedResult: '', status: 'pass' },
  ],
};

const baseInputBySuiteName: IngestRunInput = {
  externalId: 'ci-run-42',
  source: 'api',
  suiteName: 'Checkout',
  name: 'Checkout regression',
  cases: [
    { name: 'Adds to cart', steps: [], expectedResult: '', status: 'pass' },
  ],
};

describe('deriveRunStatus', () => {
  it.each([
    [['fail'], 'fail'],
    [['fail', 'pass'], 'fail'],
    [['pending'], 'running'],
    [['running'], 'running'],
    [['pass', 'pending'], 'running'],
    [['pass'], 'pass'],
    [['skip'], 'pass'],
    [['pass', 'skip', 'blocked'], 'pass'],
    [['blocked', 'skip'], 'pass'],
    [['blocked'], 'fail'],
  ] as const)('derives %p as %s', (statuses, expected) => {
    expect(deriveRunStatus(statuses)).toBe(expected);
  });
});

describe('RunsService.ingest suite resolution', () => {
  it('resolves the suite by id scoped to the api key project', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    expect(prisma.suite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'suite-1', projectId: 'project-1' },
      }),
    );
  });

  it('resolves an existing suite by its ingestion key without creating a duplicate', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInputBySuiteName);

    expect(prisma.suite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ingestionKey: 'Checkout', projectId: 'project-1' },
      }),
    );
    expect(prisma.suite.create).not.toHaveBeenCalled();
    expect(prisma.suite.update).not.toHaveBeenCalled();
  });

  it('keeps matching a suite that a person or Aeris renamed, so no duplicate appears', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({
      id: 'suite-renamed',
      name: 'Esquema del token de acceso',
    });

    await build(prisma).ingest(apiKey, baseInputBySuiteName);

    expect(prisma.suite.create).not.toHaveBeenCalled();
    const [call] = prisma.run.upsert.mock.calls[0] as [
      { create: { suiteId: string } },
    ];
    expect(call.create.suiteId).toBe('suite-renamed');
  });

  it('adopts a legacy suite by name once and stamps its ingestion key so it never falls back again', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'suite-legacy', name: 'Checkout' });

    await build(prisma).ingest(apiKey, baseInputBySuiteName);

    expect(prisma.suite.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { name: 'Checkout', projectId: 'project-1', ingestionKey: null },
      }),
    );
    expect(prisma.suite.update).toHaveBeenCalledWith({
      where: { id: 'suite-legacy' },
      data: { ingestionKey: 'Checkout' },
    });
    expect(prisma.suite.create).not.toHaveBeenCalled();
  });

  it('never rewrites the name of a suite it matched', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue({
      id: 'suite-renamed',
      name: 'Esquema del token de acceso',
    });

    await build(prisma).ingest(apiKey, baseInputBySuiteName);

    const nameWrites = (prisma.suite.update.mock.calls as [{ data: Record<string, unknown> }][])
      .filter(([call]) => 'name' in call.data);
    expect(nameWrites).toHaveLength(0);
  });

  it('returns suite-not-found when suiteId does not resolve to a suite in this project', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);

    const result = await build(prisma).ingest(apiKey, baseInput);

    expect(result).toEqual({ ok: false, error: 'suite-not-found' });
    expect(prisma.run.upsert).not.toHaveBeenCalled();
  });
});

describe('RunsService.ingest suite adoption', () => {
  it('adopts an unknown suiteName by creating the suite instead of 404ing', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);

    const result = await build(prisma).ingest(apiKey, baseInputBySuiteName);

    expect(result.ok).toBe(true);
    expect(prisma.suite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          projectId: 'project-1',
          organizationId: 'org-1',
          name: 'Checkout',
          ingestionKey: 'Checkout',
        },
      }),
    );
  });

  it('stores the run against the newly adopted suite', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);

    await build(prisma).ingest(apiKey, baseInputBySuiteName);

    const [call] = prisma.run.upsert.mock.calls as [
      [{ create: { suiteId: string } }],
    ];
    expect(call[0].create.suiteId).toBe('suite-adopted');
  });

  it('never adopts a suite from an unresolved suiteId, unlike suiteName', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);

    const result = await build(prisma).ingest(apiKey, baseInput);

    expect(result).toEqual({ ok: false, error: 'suite-not-found' });
    expect(prisma.suite.create).not.toHaveBeenCalled();
  });

  it('falls back to the existing suite when adoption races into a unique violation', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);
    prisma.suite.create.mockRejectedValue({ code: 'P2002' });
    prisma.suite.findFirstOrThrow.mockResolvedValue({
      id: 'suite-raced',
      name: 'Checkout',
    });

    const result = await build(prisma).ingest(apiKey, baseInputBySuiteName);

    expect(result.ok).toBe(true);
    const [call] = prisma.run.upsert.mock.calls as [
      [{ create: { suiteId: string } }],
    ];
    expect(call[0].create.suiteId).toBe('suite-raced');
  });
});

describe('RunsService.ingest source guard', () => {
  it('rejects a manual source even if it bypasses the schema', async () => {
    const prisma = createPrisma();
    const manualInput = {
      ...baseInput,
      source: 'manual',
    } as unknown as IngestRunInput;

    const result = await build(prisma).ingest(apiKey, manualInput);

    expect(result).toEqual({ ok: false, error: 'source-not-allowed' });
    expect(prisma.suite.findFirst).not.toHaveBeenCalled();
  });
});

describe('RunsService.ingest idempotency', () => {
  it('upserts on the compound unique key instead of always creating', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    expect(prisma.run.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId_source_externalId: {
            projectId: 'project-1',
            source: 'api',
            externalId: 'ci-run-42',
          },
        },
      }),
    );
  });

  it('replaces the case set instead of appending to it', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    expect(prisma.runCase.deleteMany).toHaveBeenCalledWith({
      where: { runId: 'run-1' },
    });
    expect(prisma.runCase.createManyAndReturn).toHaveBeenCalledTimes(1);

    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [{ data: { runId: string }[] }],
    ];
    expect(call[0].data).toHaveLength(baseInput.cases.length);
    expect(call[0].data.every((row) => row.runId === 'run-1')).toBe(true);
  });
});

describe('RunsService.ingest test case linking', () => {
  it('links testCaseId when the automationKey matches an official test case', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [{ data: { name: string; testCaseId: string | null }[] }],
    ];
    expect(call[0].data[0]).toEqual(
      expect.objectContaining({ name: 'Adds to cart', testCaseId: 'case-1' }),
    );
  });

  it('links testCaseId to a freshly created draft when no official test case matches the automationKey', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'draft-case-1', automationKey: 'Unmatched case' },
      ]);

    await build(prisma).ingest(apiKey, {
      ...baseInput,
      cases: [
        {
          name: 'Unmatched case',
          steps: [],
          expectedResult: '',
          status: 'pass',
        },
      ],
    });

    expect(prisma.testCase.createMany).toHaveBeenCalledWith({
      data: [
        {
          suiteId: 'suite-1',
          projectId: 'project-1',
          name: 'Unmatched case',
          state: 'draft',
          executionMode: 'automated',
          automationKey: 'Unmatched case',
        },
      ],
      skipDuplicates: true,
    });

    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [{ data: { name: string; testCaseId: string | null }[] }],
    ];
    expect(call[0].data[0]).toEqual(
      expect.objectContaining({
        name: 'Unmatched case',
        testCaseId: 'draft-case-1',
      }),
    );
  });

  it('persists the reported className and filePath onto a freshly created draft', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'draft-case-1', automationKey: 'Unmatched case' },
      ]);

    await build(prisma).ingest(apiKey, {
      ...baseInput,
      cases: [
        {
          name: 'Unmatched case',
          steps: [],
          expectedResult: '',
          status: 'pass',
          className: 'checkout.spec',
          filePath: 'e2e/checkout.spec.ts',
        },
      ],
    });

    expect(prisma.testCase.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          automationClassName: 'checkout.spec',
          automationFilePath: 'e2e/checkout.spec.ts',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('creates no draft and no duplicate work when every reported automationKey already has an official case', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    expect(prisma.testCase.createMany).not.toHaveBeenCalled();
    expect(prisma.testCase.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('RunsService.ingest legacy name fallback', () => {
  it('matches a pre-migration case by name when its automationKey is still null, and backfills the key', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany.mockResolvedValueOnce([
      { id: 'case-1', automationKey: null, name: 'Adds to cart' },
    ]);

    const result = await build(prisma).ingest(apiKey, baseInput);

    expect(result.ok).toBe(true);
    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { automationKey: 'Adds to cart' },
    });
    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [{ data: { testCaseId: string | null }[] }],
    ];
    expect(call[0].data[0].testCaseId).toBe('case-1');
  });

  it('stays matched to the same official case after the reporter emits the same raw name again, once renamed by QA', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany.mockResolvedValue([
      {
        id: 'case-1',
        automationKey: 'Adds to cart',
        name: 'Adds an item to the shopping cart',
      },
    ]);

    const result = await build(prisma).ingest(apiKey, baseInput);

    expect(result.ok).toBe(true);
    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [{ data: { testCaseId: string | null }[] }],
    ];
    expect(call[0].data[0].testCaseId).toBe('case-1');
    expect(prisma.testCase.createMany).not.toHaveBeenCalled();
  });
});

describe('RunsService.ingest legacy fallback excludes manual cases', () => {
  it('never matches a manual case by name, even when automationKey is null', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    expect(prisma.testCase.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          suiteId: 'suite-1',
          OR: [
            { automationKey: { in: ['Adds to cart'] } },
            {
              automationKey: null,
              executionMode: 'automated',
              name: { in: ['Adds to cart'] },
            },
          ],
        },
      }),
    );
  });

  it('drafts a new automated case instead of adopting a manual case with a colliding name', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: 'Adds to cart' }])
      .mockResolvedValueOnce([
        { id: 'draft-case-9', automationKey: 'Adds to cart' },
      ]);

    const result = await build(prisma).ingest(apiKey, baseInput);

    expect(result.ok).toBe(true);
    expect(prisma.testCase.update).not.toHaveBeenCalled();
    expect(prisma.testCase.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            executionMode: 'automated',
            automationKey: 'Adds to cart',
          }),
        ],
      }),
    );
    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [{ data: { testCaseId: string | null }[] }],
    ];
    expect(call[0].data[0].testCaseId).toBe('draft-case-9');
  });
});

describe('RunsService.ingest humanized title collisions', () => {
  it('falls back to the raw automationKey as the case name when the humanized title already names another case in the suite', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: 'Renders greeting' }])
      .mockResolvedValueOnce([
        { id: 'draft-case-2', automationKey: 'renders_greeting' },
      ]);

    await build(prisma).ingest(apiKey, {
      ...baseInput,
      cases: [
        {
          name: 'renders_greeting',
          steps: [],
          expectedResult: '',
          status: 'pass',
        },
      ],
    });

    expect(prisma.testCase.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          name: 'renders_greeting',
          automationKey: 'renders_greeting',
        }),
      ],
      skipDuplicates: true,
    });
  });
});

describe('RunsService.ingest known suite with unregistered cases', () => {
  it('drafts only the case names that have no matching official test case', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany
      .mockResolvedValueOnce([
        { id: 'case-1', automationKey: 'Adds to cart', name: 'Adds to cart' },
      ])
      .mockResolvedValueOnce([{ name: 'Adds to cart' }])
      .mockResolvedValueOnce([
        { id: 'draft-case-2', automationKey: 'A brand new case' },
      ]);

    await build(prisma).ingest(apiKey, {
      ...baseInput,
      cases: [
        { name: 'Adds to cart', steps: [], expectedResult: '', status: 'pass' },
        {
          name: 'A brand new case',
          steps: [],
          expectedResult: '',
          status: 'pass',
        },
      ],
    });

    expect(prisma.testCase.createMany).toHaveBeenCalledWith({
      data: [
        {
          suiteId: 'suite-1',
          projectId: 'project-1',
          name: 'A brand new case',
          state: 'draft',
          executionMode: 'automated',
          automationKey: 'A brand new case',
        },
      ],
      skipDuplicates: true,
    });
  });
});

describe('RunsService.ingest official case linkage', () => {
  it('projects the linked official case onto the response, since createManyAndReturn cannot select nested relations', async () => {
    const prisma = createPrisma();
    prisma.txRunCaseFindMany.mockResolvedValue([
      caseRow({
        testCaseId: 'case-1',
        testCase: {
          id: 'case-1',
          suiteId: 'suite-1',
          steps: ['open', 'add'],
          expectedResult: 'cart has one item',
          currentVersion: null,
        },
      }),
    ]);

    const result = await build(prisma).ingest(apiKey, baseInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].officialCase).not.toBeNull();
    expect(result.value.cases[0].officialCase?.id).toBe('case-1');
    expect(result.value.cases[0].officialCase?.version).toBeNull();
  });
});

describe('RunsService.ingest JUnit result details', () => {
  it('carries the optional JUnit detail fields through to the persisted case', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, {
      ...baseInput,
      cases: [
        {
          name: 'Adds to cart',
          steps: [],
          expectedResult: '',
          status: 'fail',
          className: 'checkout.spec',
          filePath: 'e2e/checkout.spec.ts',
          durationMs: 500,
          failureType: 'AssertionError',
          failureMessage: 'expected 200',
          failureDetails: 'at checkout.spec.ts:12',
        },
      ],
    });

    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [{ data: Record<string, unknown>[] }],
    ];
    expect(call[0].data[0]).toEqual(
      expect.objectContaining({
        className: 'checkout.spec',
        filePath: 'e2e/checkout.spec.ts',
        durationMs: 500,
        failureType: 'AssertionError',
        failureMessage: 'expected 200',
        failureDetails: 'at checkout.spec.ts:12',
      }),
    );
  });

  it('omits the optional JUnit detail fields entirely when the case does not report them', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [{ data: Record<string, unknown>[] }],
    ];
    expect(call[0].data[0]).not.toHaveProperty('className');
    expect(call[0].data[0]).not.toHaveProperty('durationMs');
    expect(call[0].data[0]).not.toHaveProperty('failureMessage');
  });

  it('projects the JUnit detail fields from the reloaded case onto the response', async () => {
    const prisma = createPrisma();
    prisma.txRunCaseFindMany.mockResolvedValue([
      caseRow({
        status: 'skip',
        className: 'tests.checkout.test_checkout',
        filePath: 'tests/checkout/test_checkout.py',
        durationMs: 30,
        skipReason: 'requires network',
      }),
    ]);

    const result = await build(prisma).ingest(apiKey, baseInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cases[0].className).toBe(
      'tests.checkout.test_checkout',
    );
    expect(result.value.cases[0].filePath).toBe(
      'tests/checkout/test_checkout.py',
    );
    expect(result.value.cases[0].durationMs).toBe(30);
    expect(result.value.cases[0].skipReason).toBe('requires network');
  });
});

describe('RunsService.ingest case reload transaction scoping', () => {
  it('reloads the case set from the transaction client, not the outer prisma client, so a concurrent retry cannot leak in', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    expect(prisma.txRunCaseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { runId: 'run-1' } }),
    );
    expect(prisma.runCase.findMany).not.toHaveBeenCalled();
  });
});

describe('RunsService.ingest notifications', () => {
  it('publishes run_completed when the derived status is pass', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();

    await build(prisma, notifications).ingest(apiKey, baseInput);

    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'run_completed',
        dedupeKey: 'run_completed:run-1',
      }),
    );
  });

  it('publishes run_failed when the derived status is fail', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();

    await build(prisma, notifications).ingest(apiKey, {
      ...baseInput,
      cases: [
        { name: 'Adds to cart', steps: [], expectedResult: '', status: 'fail' },
      ],
    });

    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'run_failed',
        dedupeKey: 'run_failed:run-1',
      }),
    );
  });

  it('publishes on a later report that flips a run to fail, not only on create', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    const service = build(prisma, notifications);

    await service.ingest(apiKey, {
      ...baseInput,
      cases: [
        {
          name: 'Adds to cart',
          steps: [],
          expectedResult: '',
          status: 'running',
        },
      ],
    });
    await service.ingest(apiKey, {
      ...baseInput,
      cases: [
        { name: 'Adds to cart', steps: [], expectedResult: '', status: 'fail' },
      ],
    });

    const runFailedCalls = notifications.publish.mock.calls.filter(
      ([event]: [{ eventType: string }]) => event.eventType === 'run_failed',
    );
    expect(runFailedCalls).toHaveLength(1);
  });

  it('does not publish for a non-terminal derived status', async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();

    await build(prisma, notifications).ingest(apiKey, {
      ...baseInput,
      cases: [
        {
          name: 'Adds to cart',
          steps: [],
          expectedResult: '',
          status: 'running',
        },
      ],
    });

    expect(notifications.publish).not.toHaveBeenCalled();
  });
});
