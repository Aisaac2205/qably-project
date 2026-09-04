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

const officialCases = [{ id: 'case-1', name: 'Adds to cart' }];

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
  };
  testCase: { findMany: jest.Mock; createMany: jest.Mock };
  run: { upsert: jest.Mock };
  runCase: { deleteMany: jest.Mock; createManyAndReturn: jest.Mock };
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
    },
    testCase: {
      findMany: jest.fn().mockResolvedValue(officialCases),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    run: { upsert: jest.fn().mockResolvedValue(runRow) },
    runCase: {
      deleteMany: jest.fn(),
      createManyAndReturn: jest.fn().mockResolvedValue([caseRow({})]),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
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

  it('resolves an existing suite by name without creating a duplicate', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInputBySuiteName);

    expect(prisma.suite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: 'Checkout', projectId: 'project-1' },
      }),
    );
    expect(prisma.suite.create).not.toHaveBeenCalled();
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
  it('links testCaseId when the case name matches an official test case', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    const [call] = prisma.runCase.createManyAndReturn.mock.calls as [
      [{ data: { name: string; testCaseId: string | null }[] }],
    ];
    expect(call[0].data[0]).toEqual(
      expect.objectContaining({ name: 'Adds to cart', testCaseId: 'case-1' }),
    );
  });

  it('links testCaseId to a freshly created draft when no official test case matches the name', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'draft-case-1', name: 'Unmatched case' }]);

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

  it('creates no draft and no duplicate work when every reported name already has an official case', async () => {
    const prisma = createPrisma();

    await build(prisma).ingest(apiKey, baseInput);

    expect(prisma.testCase.createMany).not.toHaveBeenCalled();
    expect(prisma.testCase.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('RunsService.ingest known suite with unregistered cases', () => {
  it('drafts only the case names that have no matching official test case', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany
      .mockResolvedValueOnce([{ id: 'case-1', name: 'Adds to cart' }])
      .mockResolvedValueOnce([
        { id: 'case-1', name: 'Adds to cart' },
        { id: 'draft-case-2', name: 'A brand new case' },
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
        },
      ],
      skipDuplicates: true,
    });
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
