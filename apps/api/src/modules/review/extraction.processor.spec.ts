import { Logger } from '@nestjs/common';
import { DEFAULT_LOCALE } from '@qably/i18n';
import type { Env } from '../../config/env';
import type { AiDailyBudget } from '../ai/ai-daily-budget.service';
import type { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { SourceReader } from '../repository/source-reader';
import type { TestFileLocator } from '../repository/test-file-locator';
import {
  MAX_EXTRACTED_CASES,
  type TestCaseExtractor,
} from '../ai/extraction.contracts';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction-prompt';
import { ExtractionFailureRecorder } from './extraction-failure-recorder';
import { ExtractedProposalWriter } from './extracted-proposal-writer';
import { ExtractionProcessor } from './extraction.processor';

function extractedCase(overrides: Record<string, unknown> = {}) {
  return {
    automationKey: 'Cart > adds an item',
    title: 'Adds an item to the cart',
    objective: 'Verify the cart total updates',
    preconditions: [],
    steps: ['Add one item', 'Read the total'],
    expectedResult: 'The total reflects the item price',
    priority: 'medium',
    sourceExcerpt: "it('adds an item', () => {})",
    ...overrides,
  };
}

interface FakePrisma {
  codeChange: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  testCase: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  testCaseVersion: { count: jest.Mock; create: jest.Mock };
  suite: { findFirst: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  evidence: { create: jest.Mock; update: jest.Mock };
  extractedProposal: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
  $executeRawUnsafe: jest.Mock;
  $queryRawUnsafe: jest.Mock;
}

const connection = {
  provider: 'GITHUB' as const,
  repo: 'qably/qably',
  encryptedAccessToken: null as string | null,
};

const codeChangeRow = {
  id: 'change-1',
  projectId: 'project-1',
  filePath: 'src/cart.spec.ts',
  commitSha: 'sha-1',
  evidenceId: 'evidence-blob-1',
  project: { organizationId: 'org-1', connection },
};

const TEST_ENV = { GEMINI_MODEL: 'gemini-test' } as Env;

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    codeChange: {
      findUnique: jest.fn().mockResolvedValue(codeChangeRow),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    testCase: {
      findUnique: jest.fn(),
      findFirst: jest
        .fn()
        .mockImplementation((args: { where: Record<string, unknown> }) =>
          Promise.resolve('automationFilePath' in args.where ? null : null),
        ),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'case-updated' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    testCaseVersion: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'version-new', version: 1 }),
    },
    suite: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({ id: 'suite-by-name' })
        .mockResolvedValue({ id: 'suite-by-name' }),
      update: jest.fn().mockResolvedValue({ id: 'suite-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    evidence: {
      create: jest.fn().mockResolvedValue({ id: 'evidence-new' }),
      update: jest.fn().mockResolvedValue({ id: 'evidence-existing' }),
    },
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'proposal-new' }),
      update: jest.fn().mockResolvedValue({ id: 'proposal-updated' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ nameSource: 'ingestion' }]),
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
  );

  return prisma;
}

function fakeSourceReader(
  read: SourceReader['read'] = jest.fn().mockResolvedValue({
    kind: 'content',
    content: 'file body',
    truncated: false,
  }),
): SourceReader {
  return { read } as unknown as SourceReader;
}

function fakeExtractor(
  extract: jest.Mock,
  summarizeSuite: jest.Mock = jest.fn().mockResolvedValue({
    kind: 'provider-unavailable',
    reason: 'not-configured',
    retryable: false,
  }),
): TestCaseExtractor {
  return { extract, summarizeSuite };
}

function fakeEncryption(decrypt: jest.Mock = jest.fn()): EncryptionService {
  return { decrypt } as unknown as EncryptionService;
}

function fakeEntitlement(
  isEntitled: jest.Mock = jest.fn().mockResolvedValue(true),
  spendCredit: jest.Mock = jest.fn().mockResolvedValue(true),
): AiEntitlementService {
  return {
    isEntitled,
    spendCredit,
    maxSourceCharacters: jest.fn().mockResolvedValue(60_000),
  } as unknown as AiEntitlementService;
}

function fakeDailyBudget(
  tryConsume: jest.Mock = jest.fn().mockResolvedValue(true),
): AiDailyBudget {
  return { tryConsume } as unknown as AiDailyBudget;
}

function fakeTestFileLocator(
  locate: jest.Mock = jest.fn().mockResolvedValue(null),
): TestFileLocator {
  return { locate } as unknown as TestFileLocator;
}

function build(
  prisma: FakePrisma,
  sourceReader: SourceReader,
  extractor: TestCaseExtractor,
  encryption: EncryptionService = fakeEncryption(),
  entitlement: AiEntitlementService = fakeEntitlement(),
  dailyBudget: AiDailyBudget = fakeDailyBudget(),
  testFileLocator: TestFileLocator = fakeTestFileLocator(),
  publish: jest.Mock = jest.fn(),
  env: Env = TEST_ENV,
) {
  return new ExtractionProcessor(
    prisma as never,
    sourceReader,
    extractor,
    encryption,
    entitlement,
    dailyBudget,
    testFileLocator,
    new ExtractionFailureRecorder(prisma as never),
    new ExtractedProposalWriter(
      prisma as never,
      entitlement,
      { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
      { publish } as never,
    ),
    env,
    { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
  );
}

interface CallArgs {
  data?: Record<string, unknown>;
  where?: Record<string, unknown>;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
}

function lastCall(mock: jest.Mock): CallArgs {
  const calls = mock.mock.calls as [CallArgs][];
  return calls[calls.length - 1][0];
}

// A push takes an advisory lock per case before it writes; the savepoint
// choreography around each proposal is what these tests pin, so the locks are
// left out of the raw statements they read back.
function savepointStatements(
  prisma: FakePrisma,
): { sql: string; order: number }[] {
  const calls = prisma.$executeRawUnsafe.mock.calls as [string][];
  const orders = prisma.$executeRawUnsafe.mock.invocationCallOrder;

  return calls
    .map(([sql], index) => ({ sql, order: orders[index] }))
    .filter(({ sql }) => !sql.includes('pg_advisory_xact_lock'));
}

function extractedOutcome(
  cases: ReturnType<typeof extractedCase>[],
  suite: { title: string; description: string; tags?: string[] } | null = null,
) {
  return {
    kind: 'extracted' as const,
    cases,
    suite,
    usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
  };
}

describe('ExtractionProcessor — code-change job still proposes (CONTEXT.md §4.3.4 b regression guard)', () => {
  it('still creates an ExtractedProposal for a code-change extraction, unlike the document-file direct-write path', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
    expect(prisma.testCaseVersion.create).not.toHaveBeenCalled();
    expect(prisma.testCase.update).not.toHaveBeenCalled();
  });
});

describe('ExtractionProcessor — new proposals notification', () => {
  const pushBatch = {
    batchId: 'batch-1',
    commitSha: 'sha-1',
    batch: { scmEvent: { author: 'ada', branch: 'main' } },
  };

  function buildWithPublish(
    prisma: FakePrisma,
    extract: jest.Mock,
    publish: jest.Mock,
  ) {
    return build(
      prisma,
      fakeSourceReader(),
      fakeExtractor(extract),
      fakeEncryption(),
      fakeEntitlement(),
      fakeDailyBudget(),
      fakeTestFileLocator(),
      publish,
    );
  }

  it('announces the batch of a push once its proposals are saved', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique
      .mockResolvedValueOnce(codeChangeRow)
      .mockResolvedValueOnce(pushBatch);
    const publish = jest.fn();

    await buildWithPublish(
      prisma,
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
      publish,
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith('proposals.created', {
      source: 'push',
      organizationId: 'org-1',
      projectId: 'project-1',
      batchId: 'batch-1',
      count: 1,
      commitSha: 'sha-1',
      author: 'ada',
      branch: 'main',
    });
  });

  it('announces a documented case by its proposal id', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      id: 'case-1',
      projectId: 'project-1',
      suiteId: 'suite-1',
      automationKey: 'Cart > adds an item',
      automationFilePath: 'src/cart.spec.ts',
      project: { organizationId: 'org-1', connection },
    });
    const publish = jest.fn();

    await buildWithPublish(
      prisma,
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
      publish,
    ).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith('proposals.created', {
      source: 'documentation',
      organizationId: 'org-1',
      projectId: 'project-1',
      batchId: 'proposal-new',
      count: 1,
    });
  });

  it('announces nothing when the extraction found no tests and the file fell back to manual review', async () => {
    const prisma = createPrisma();
    const publish = jest.fn();

    await buildWithPublish(
      prisma,
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
      publish,
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(publish).not.toHaveBeenCalled();
  });

  it('announces nothing for a document-file job, which publishes versions directly instead of proposing', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      projectId: 'project-1',
      project: { organizationId: 'org-1', connection },
    });
    prisma.testCase.findMany.mockResolvedValue([
      {
        id: 'case-1',
        suiteId: 'suite-1',
        name: 'adds an item',
        documentationSource: 'aeris',
        currentVersion: null,
      },
    ]);
    const publish = jest.fn();
    const extract = jest
      .fn()
      .mockResolvedValue(extractedOutcome([extractedCase()]));

    await buildWithPublish(prisma, extract, publish).process({
      data: {
        kind: 'document-file',
        filePath: 'src/cart.spec.ts',
        targets: [
          { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
        ],
      },
    } as never);

    expect(extract).toHaveBeenCalledTimes(1);
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('ExtractionProcessor — code-change job', () => {
  it('persists a new proposal with evidence, suite and prompt version for an extracted case', async () => {
    const prisma = createPrisma();
    const sourceReader = fakeSourceReader();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, sourceReader, extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const evidenceCall = lastCall(prisma.evidence.create);
    expect(evidenceCall.data).toMatchObject({
      projectId: 'project-1',
      kind: 'SOURCE_EXCERPT',
      title: 'src/cart.spec.ts',
      excerpt: "it('adds an item', () => {})",
    });

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      projectId: 'project-1',
      evidenceId: 'evidence-new',
      codeChangeId: 'change-1',
      automationKey: 'Cart > adds an item',
      suiteId: 'suite-by-name',
      targetTestCaseId: null,
      status: 'in_review',
      title: 'Adds an item to the cart',
      promptVersion: EXTRACTION_PROMPT_VERSION,
    });

    const statements = savepointStatements(prisma);
    expect(statements.map(({ sql }) => sql)).toEqual([
      'SAVEPOINT extraction_proposal',
      'RELEASE SAVEPOINT extraction_proposal',
    ]);
    const savepointOrder = statements[0].order;
    const evidenceCreateOrder =
      prisma.evidence.create.mock.invocationCallOrder[0];
    const proposalCreateOrder =
      prisma.extractedProposal.create.mock.invocationCallOrder[0];
    const releaseOrder = statements[1].order;
    expect(savepointOrder).toBeLessThan(evidenceCreateOrder);
    expect(evidenceCreateOrder).toBeLessThan(proposalCreateOrder);
    expect(proposalCreateOrder).toBeLessThan(releaseOrder);
  });

  it('targets an existing automated test case whose automationKey matches', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-existing', automationKey: 'Cart > adds an item' },
    ]);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      targetTestCaseId: 'case-existing',
    });
  });

  it('hands the creation time of the code change to the writer, so an older push cannot undo a newer one', async () => {
    const prisma = createPrisma();
    const createdAt = new Date('2026-10-20T12:00:00.000Z');
    prisma.codeChange.findUnique.mockResolvedValue({
      ...codeChangeRow,
      createdAt,
    });
    prisma.extractedProposal.findMany.mockImplementation(
      (args: { where: Record<string, unknown> }) =>
        Promise.resolve(
          typeof args.where.codeChangeId === 'object'
            ? [
                {
                  id: 'newer-owner',
                  status: 'in_review',
                  evidenceId: 'evidence-newer',
                  automationKey: 'Cart > adds an item',
                  codeChange: {
                    id: 'change-9',
                    createdAt: new Date('2026-10-20T14:00:00.000Z'),
                  },
                },
              ]
            : [],
        ),
    );
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.codeChange.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ createdAt: true }) as unknown,
      }),
    );
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.updateMany).not.toHaveBeenCalled();
  });

  it('does nothing when the model reports no tests found', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.updateMany).not.toHaveBeenCalled();
  });

  it('creates no manual-review proposal when the project has no connection', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockResolvedValue({
      ...codeChangeRow,
      project: { organizationId: 'org-1', connection: null },
    });
    const extractSpy = jest.fn();
    const extractor = fakeExtractor(extractSpy);

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('creates no proposal and updates no case for a quota-exhausted code-change job, since it has no target case', async () => {
    const prisma = createPrisma();
    const extractSpy = jest.fn();

    await build(
      prisma,
      fakeSourceReader(),
      fakeExtractor(extractSpy),
      fakeEncryption(),
      fakeEntitlement(),
      fakeDailyBudget(jest.fn().mockResolvedValue(false)),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.testCase.updateMany).not.toHaveBeenCalled();
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('does not spend a budget slot when the source file cannot be read', async () => {
    const prisma = createPrisma();
    const tryConsume = jest.fn().mockResolvedValue(true);

    await build(
      prisma,
      fakeSourceReader(
        jest
          .fn()
          .mockResolvedValue({ kind: 'unavailable', reason: 'http-404' }),
      ),
      fakeExtractor(jest.fn()),
      fakeEncryption(),
      fakeEntitlement(),
      fakeDailyBudget(tryConsume),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(tryConsume).not.toHaveBeenCalled();
  });

  it('creates no manual-review proposal when the source is unavailable (infrastructure failure, not reviewable work)', async () => {
    const prisma = createPrisma();
    const sourceReader = fakeSourceReader(
      jest.fn().mockResolvedValue({ kind: 'unavailable', reason: 'http-404' }),
    );
    const extractSpy = jest.fn();
    const extractor = fakeExtractor(extractSpy);

    await build(prisma, sourceReader, extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.evidence.create).not.toHaveBeenCalled();
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('creates no proposal when the provider is unavailable on a code-change job', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'provider-unavailable',
        reason: 'invalid-credentials',
        retryable: false,
      }),
    );
    const spendCredit = jest.fn().mockResolvedValue(true);

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      fakeEntitlement(jest.fn().mockResolvedValue(true), spendCredit),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(spendCredit).not.toHaveBeenCalled();
  });

  it('skips the manual-review fallback when one is already pending for the code change', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({ id: 'existing' });
    prisma.codeChange.findUnique.mockResolvedValue({
      ...codeChangeRow,
      project: { organizationId: 'org-1', connection: null },
    });
    const extractor = fakeExtractor(jest.fn());

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('decrypts the connection access token before reading the source', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockResolvedValue({
      ...codeChangeRow,
      project: {
        organizationId: 'org-1',
        connection: { ...connection, encryptedAccessToken: 'enc:token' },
      },
    });
    const readSpy = jest
      .fn()
      .mockResolvedValue({ kind: 'content', content: 'x', truncated: false });
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );
    const decrypt = jest.fn().mockReturnValue('plain-token');

    await build(
      prisma,
      fakeSourceReader(readSpy),
      extractor,
      fakeEncryption(decrypt),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(decrypt).toHaveBeenCalledWith('enc:token');
    const [readArgs] = readSpy.mock.calls[0] as [{ accessToken?: string }];
    expect(readArgs.accessToken).toBe('plain-token');
  });

  it('does nothing when the code change no longer exists', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockResolvedValue(null);
    const extractSpy = jest.fn();
    const extractor = fakeExtractor(extractSpy);

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'gone' },
    } as never);

    expect(extractSpy).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('creates no proposal without calling the provider when the organization is not entitled', async () => {
    const prisma = createPrisma();
    const extractSpy = jest.fn();
    const extractor = fakeExtractor(extractSpy);
    const isEntitled = jest.fn().mockResolvedValue(false);

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      fakeEntitlement(isEntitled),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(extractSpy).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('creates no proposal when the credit decrement fails after a successful extraction', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );
    const spendCredit = jest.fn().mockResolvedValue(false);

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      fakeEntitlement(jest.fn().mockResolvedValue(true), spendCredit),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(spendCredit).toHaveBeenCalledWith('org-1', prisma);
    expect(prisma.extractedProposal.findMany).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('spends the credit inside the persisting transaction, creating no proposal when a failed persist rolls the credit back too', async () => {
    const prisma = createPrisma();
    prisma.evidence.create.mockRejectedValueOnce(new Error('db unavailable'));
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );
    const spendCredit = jest.fn().mockResolvedValue(true);

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      fakeEntitlement(jest.fn().mockResolvedValue(true), spendCredit),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(spendCredit).toHaveBeenCalledWith('org-1', prisma);
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('persists the case via a conditional update when a concurrent redelivery wins the create race, without losing the other cases in the batch', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.create.mockImplementationOnce(() => {
      throw Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
    });
    prisma.extractedProposal.findFirst.mockResolvedValueOnce({
      id: 'winner-proposal',
      status: 'in_review',
      evidenceId: 'evidence-existing',
    });
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(
        extractedOutcome([
          extractedCase({ title: 'First' }),
          extractedCase({
            automationKey: 'Cart > removes an item',
            title: 'Second',
          }),
        ]),
      ),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(2);
    const updateCall = lastCall(prisma.extractedProposal.updateMany);
    expect(updateCall.where).toEqual({
      id: 'winner-proposal',
      status: 'in_review',
    });
    expect(updateCall.data).toMatchObject({ title: 'First' });
    const secondCreateCall = lastCall(prisma.extractedProposal.create);
    expect(secondCreateCall.data).toMatchObject({
      automationKey: 'Cart > removes an item',
      title: 'Second',
    });

    expect(prisma.evidence.create).toHaveBeenCalledTimes(2);
    const savepointCalls = prisma.$executeRawUnsafe.mock.calls.map(
      ([sql]: [string]) => sql,
    );
    expect(
      savepointCalls.filter((sql) => sql === 'SAVEPOINT extraction_proposal'),
    ).toHaveLength(2);
    expect(
      savepointCalls.filter(
        (sql) => sql === 'ROLLBACK TO SAVEPOINT extraction_proposal',
      ),
    ).toHaveLength(1);
    expect(
      savepointCalls.filter(
        (sql) => sql === 'RELEASE SAVEPOINT extraction_proposal',
      ),
    ).toHaveLength(2);

    const statements = savepointStatements(prisma);
    const firstSavepointOrder = statements[0].order;
    const firstEvidenceCreateOrder =
      prisma.evidence.create.mock.invocationCallOrder[0];
    const firstProposalCreateOrder =
      prisma.extractedProposal.create.mock.invocationCallOrder[0];
    const rollbackOrder = statements[1].order;
    const releaseAfterRollbackOrder = statements[2].order;
    const findFirstOrder =
      prisma.extractedProposal.findFirst.mock.invocationCallOrder[0];

    expect(firstSavepointOrder).toBeLessThan(firstEvidenceCreateOrder);
    expect(firstEvidenceCreateOrder).toBeLessThan(firstProposalCreateOrder);
    expect(firstProposalCreateOrder).toBeLessThan(rollbackOrder);
    expect(rollbackOrder).toBeLessThan(releaseAfterRollbackOrder);
    expect(releaseAfterRollbackOrder).toBeLessThan(findFirstOrder);
  });

  it('does not mutate an already-decided proposal even when the create races and loses', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.create.mockImplementationOnce(() => {
      throw Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
    });
    prisma.extractedProposal.findFirst.mockResolvedValueOnce({
      id: 'winner-proposal',
      status: 'approved',
      evidenceId: 'evidence-existing',
    });
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.updateMany).not.toHaveBeenCalled();
    expect(prisma.evidence.update).not.toHaveBeenCalled();
  });

  it('deduplicates extracted cases sharing the same automationKey, keeping the first', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(
        extractedOutcome([
          extractedCase({ title: 'First' }),
          extractedCase({ title: 'Duplicate' }),
          extractedCase({
            automationKey: 'Cart > removes an item',
            title: 'Second',
          }),
        ]),
      ),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(2);
    const titles = prisma.extractedProposal.create.mock.calls.map(
      ([call]: [CallArgs]) => call.data?.title,
    );
    expect(titles).toEqual(['First', 'Second']);
  });

  it('does not mutate a proposal that was already decided (decided-proposal guard)', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      {
        id: 'decided-proposal',
        status: 'approved',
        evidenceId: 'evidence-existing',
        automationKey: 'Cart > adds an item',
      },
    ]);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.updateMany).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.evidence.update).not.toHaveBeenCalled();
  });

  it('reuses the existing evidence row instead of orphaning it when a pending proposal is redelivered', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      {
        id: 'pending-proposal',
        status: 'in_review',
        evidenceId: 'evidence-existing',
        automationKey: 'Cart > adds an item',
      },
    ]);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.evidence.create).not.toHaveBeenCalled();
    const evidenceUpdateCall = lastCall(prisma.evidence.update);
    expect(evidenceUpdateCall.where).toEqual({ id: 'evidence-existing' });
    const proposalUpdateCall = lastCall(prisma.extractedProposal.updateMany);
    expect(proposalUpdateCall.where).toEqual({
      id: 'pending-proposal',
      status: 'in_review',
    });
    expect(proposalUpdateCall.data).toMatchObject({
      title: 'Adds an item to the cart',
    });
  });

  it('resolves the suite by matching automationFilePath before falling back to the suite name', async () => {
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockImplementation(
      (args: { where: Record<string, unknown> }) =>
        Promise.resolve(
          'automationFilePath' in args.where
            ? { suiteId: 'suite-by-automation-path' }
            : null,
        ),
    );
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      suiteId: 'suite-by-automation-path',
    });
  });

  it('uses the locale carried on the job payload', async () => {
    const prisma = createPrisma();
    const extractSpy = jest
      .fn()
      .mockResolvedValue(extractedOutcome([extractedCase()]));
    const extractor = fakeExtractor(extractSpy);

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1', locale: 'en' },
    } as never);

    const [extractArgs] = extractSpy.mock.calls[0] as [{ locale: string }];
    expect(extractArgs.locale).toBe('en');
  });

  it('falls back to the default locale when a redelivered job predates the locale field', async () => {
    const prisma = createPrisma();
    const extractSpy = jest
      .fn()
      .mockResolvedValue(extractedOutcome([extractedCase()]));
    const extractor = fakeExtractor(extractSpy);

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const [extractArgs] = extractSpy.mock.calls[0] as [{ locale: string }];
    expect(extractArgs.locale).toBe(DEFAULT_LOCALE);
  });
});

describe('ExtractionProcessor — code-change job skips a test file that did not change', () => {
  const FILE_PATH = 'src/cart.spec.ts';
  const BASE_TIME = Date.parse('2026-10-20T10:00:00.000Z');
  const SOURCE_A = 'describe("cart", () => { it("adds an item"); });';
  const SOURCE_B = 'describe("cart", () => { it("removes an item"); });';

  interface StoredChange {
    id: string;
    projectId: string;
    filePath: string;
    createdAt: Date;
    sourceHash: string | null;
    extractedAt: Date | null;
  }

  interface RunOptions {
    content?: string;
    truncated?: boolean;
    sourceLimit?: number;
    locale?: string;
    model?: string;
    attemptsStarted?: number;
    outcome?: unknown;
  }

  function matchesClause(
    row: StoredChange,
    clause: Record<string, unknown>,
  ): boolean {
    return Object.entries(clause).every(([field, condition]) => {
      if (field === 'id') {
        return typeof condition === 'string'
          ? row.id === condition
          : row.id < (condition as { lt: string }).lt;
      }
      if (field === 'createdAt') {
        return condition instanceof Date
          ? row.createdAt.getTime() === condition.getTime()
          : row.createdAt < (condition as { lt: Date }).lt;
      }
      throw new Error(`the fake store does not understand "${field}"`);
    });
  }

  // Applies the order the processor asks for, so a query that flips it makes
  // the tests fail instead of being papered over by the fake.
  function compareChanges(
    a: StoredChange,
    b: StoredChange,
    orderBy: Record<string, 'asc' | 'desc'>[],
  ): number {
    for (const clause of orderBy) {
      const [field, direction] = Object.entries(clause)[0];
      if (field !== 'createdAt' && field !== 'id') {
        throw new Error(`the fake store cannot order by "${field}"`);
      }

      const left = field === 'createdAt' ? a.createdAt.getTime() : a.id;
      const right = field === 'createdAt' ? b.createdAt.getTime() : b.id;
      if (left === right) continue;

      const ascending = left < right ? -1 : 1;
      return direction === 'desc' ? -ascending : ascending;
    }

    return 0;
  }

  // The code_change table as far as the processor reads and writes it, so the
  // tests drive whole sequences of pushes instead of canned answers.
  function pushes() {
    const prisma = createPrisma();
    const changes = new Map<string, StoredChange>();

    prisma.codeChange.findUnique.mockImplementation(
      (args: { where: { id: string } }) => {
        const change = changes.get(args.where.id);
        if (change === undefined) return Promise.resolve(null);

        return Promise.resolve({
          ...codeChangeRow,
          id: change.id,
          createdAt: change.createdAt,
          batchId: 'batch-1',
          batch: { scmEvent: null },
        });
      },
    );
    prisma.codeChange.findMany.mockImplementation(
      (args: {
        where: Record<string, unknown>;
        take?: number;
        orderBy?: Record<string, 'asc' | 'desc'>[];
      }) => {
        const where = args.where as {
          projectId: string;
          filePath: string;
          OR?: Record<string, unknown>[];
          id?: string;
        };
        const found = [...changes.values()]
          .filter(
            (change) =>
              change.projectId === where.projectId &&
              change.filePath === where.filePath,
          )
          .filter((change) =>
            where.OR === undefined
              ? where.id === undefined || change.id === where.id
              : where.OR.some((clause) => matchesClause(change, clause)),
          )
          .sort((a, b) => compareChanges(a, b, args.orderBy ?? []));

        return Promise.resolve(found.slice(0, args.take ?? found.length));
      },
    );
    prisma.codeChange.updateMany.mockImplementation(
      (args: { where: { id: string }; data: Partial<StoredChange> }) => {
        const change = changes.get(args.where.id);
        if (change === undefined) return Promise.resolve({ count: 0 });

        Object.assign(change, args.data);
        return Promise.resolve({ count: 1 });
      },
    );

    const extract = jest
      .fn()
      .mockResolvedValue(extractedOutcome([extractedCase()]));
    const tryConsume = jest.fn().mockResolvedValue(true);
    const spendCredit = jest.fn().mockResolvedValue(true);

    // The n-th push touching the file, one minute after the one before it.
    function push(id: string, order: number): StoredChange {
      const change: StoredChange = {
        id,
        projectId: 'project-1',
        filePath: FILE_PATH,
        createdAt: new Date(BASE_TIME + order * 60_000),
        sourceHash: null,
        extractedAt: null,
      };
      changes.set(id, change);
      return change;
    }

    async function run(id: string, options: RunOptions = {}): Promise<void> {
      const entitlement = {
        isEntitled: jest.fn().mockResolvedValue(true),
        spendCredit,
        maxSourceCharacters: jest
          .fn()
          .mockResolvedValue(options.sourceLimit ?? 60_000),
      } as unknown as AiEntitlementService;
      const read = jest.fn().mockResolvedValue({
        kind: 'content',
        content: options.content ?? SOURCE_A,
        truncated: options.truncated ?? false,
      });
      extract.mockResolvedValue(
        options.outcome ?? extractedOutcome([extractedCase()]),
      );

      await build(
        prisma,
        fakeSourceReader(read),
        fakeExtractor(extract),
        fakeEncryption(),
        entitlement,
        fakeDailyBudget(tryConsume),
        undefined,
        undefined,
        { GEMINI_MODEL: options.model ?? 'gemini-test' } as Env,
      ).process({
        data: {
          kind: 'code-change',
          codeChangeId: id,
          ...(options.locale === undefined ? {} : { locale: options.locale }),
        },
        attemptsStarted: options.attemptsStarted ?? 1,
        opts: { attempts: 3 },
      } as never);
    }

    return { prisma, changes, push, run, extract, tryConsume, spendCredit };
  }

  const providerDown = (retryable: boolean) => ({
    kind: 'provider-unavailable',
    reason: 'rate-limited',
    retryable,
  });

  const nCases = (count: number) =>
    extractedOutcome(
      Array.from({ length: count }, (_, index) =>
        extractedCase({ automationKey: `Cart > case ${String(index)}` }),
      ),
    );

  function quietLogs() {
    return [
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
    ];
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('a file identical to the previous push', () => {
    it('skips the daily budget, the model and the credit', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      quietLogs();

      await store.run('change-1');
      await store.run('change-2');

      expect(store.extract).toHaveBeenCalledTimes(1);
      expect(store.tryConsume).toHaveBeenCalledTimes(1);
      expect(store.spendCredit).toHaveBeenCalledTimes(1);
      expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
    });

    it('logs one line and stamps the skipped push, so the next push compares with it', async () => {
      const store = pushes();
      store.push('change-1', 1);
      const second = store.push('change-2', 2);
      store.push('change-3', 3);
      const [log] = quietLogs();

      await store.run('change-1');
      await store.run('change-2');
      await store.run('change-3');

      expect(log).toHaveBeenCalledWith(expect.stringContaining(FILE_PATH));
      expect(second.extractedAt).toBeInstanceOf(Date);
      expect(second.sourceHash).toBe(store.changes.get('change-1')?.sourceHash);
      expect(store.extract).toHaveBeenCalledTimes(1);
    });

    it('still skips on a retry attempt', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      quietLogs();

      await store.run('change-1');
      await store.run('change-2', { attemptsStarted: 2 });

      expect(store.extract).toHaveBeenCalledTimes(1);
      expect(store.tryConsume).toHaveBeenCalledTimes(1);
    });

    it('does not rewrite a push that was already extracted when its job is delivered again', async () => {
      const store = pushes();
      store.push('change-1', 1);
      quietLogs();

      await store.run('change-1');
      const stamped = store.changes.get('change-1')?.extractedAt;
      const writes = store.prisma.codeChange.updateMany.mock.calls.length;
      await store.run('change-1');

      expect(store.extract).toHaveBeenCalledTimes(1);
      expect(store.prisma.codeChange.updateMany).toHaveBeenCalledTimes(writes);
      expect(store.changes.get('change-1')?.extractedAt).toBe(stamped);
    });

    it('extracts again when a job is delivered again after its proposals were saved but never stamped', async () => {
      const store = pushes();
      store.push('change-1', 1);
      quietLogs();
      const write = store.prisma.codeChange.updateMany.getMockImplementation();
      store.prisma.codeChange.updateMany
        .mockImplementationOnce(write as never)
        .mockRejectedValueOnce(new Error('db gone'));

      await store.run('change-1');
      expect(store.changes.get('change-1')?.extractedAt).toBeNull();
      await store.run('change-1');

      expect(store.extract).toHaveBeenCalledTimes(2);
      expect(store.changes.get('change-1')?.extractedAt).toBeInstanceOf(Date);
    });
  });

  describe('a file that differs from the previous push', () => {
    it('runs when the content changed', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      quietLogs();

      await store.run('change-1');
      await store.run('change-2', { content: SOURCE_B });

      expect(store.extract).toHaveBeenCalledTimes(2);
      expect(store.tryConsume).toHaveBeenCalledTimes(2);
    });

    it('runs when the model changed, and skips again once it is stable', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      store.push('change-3', 3);
      quietLogs();

      await store.run('change-1', { model: 'gemini-a' });
      await store.run('change-2', { model: 'gemini-b' });
      await store.run('change-3', { model: 'gemini-b' });

      expect(store.extract).toHaveBeenCalledTimes(2);
    });

    it('runs when the locale changed', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      quietLogs();

      await store.run('change-1', { locale: 'en' });
      await store.run('change-2', { locale: 'es' });

      expect(store.extract).toHaveBeenCalledTimes(2);
    });

    it('does not extract a file that fit again when only the plan limit changed', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      quietLogs();

      await store.run('change-1', { sourceLimit: 60_000 });
      await store.run('change-2', { sourceLimit: 1_000_000 });

      expect(store.extract).toHaveBeenCalledTimes(1);
    });

    it('extracts a truncated file again when the plan limit changed', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      quietLogs();

      await store.run('change-1', { sourceLimit: 60_000, truncated: true });
      await store.run('change-2', { sourceLimit: 1_000_000, truncated: true });

      expect(store.extract).toHaveBeenCalledTimes(2);
    });

    it('skips a truncated file at the same limit, since a re-extraction cannot see more', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      quietLogs();

      await store.run('change-1', { truncated: true });
      await store.run('change-2', { truncated: true });

      expect(store.extract).toHaveBeenCalledTimes(1);
    });
  });

  describe('the push it is compared with', () => {
    it('is the one recorded immediately before it, even when an older one matches', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      store.push('change-3', 3);
      quietLogs();

      await store.run('change-1', { content: SOURCE_A });
      await store.run('change-2', { content: SOURCE_B });
      await store.run('change-3', { content: SOURCE_A });

      expect(store.extract).toHaveBeenCalledTimes(3);
    });

    it('does not hide a revert while the push in between is still in its retry backoff', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      store.push('change-3', 3);
      quietLogs();

      await store.run('change-1', { content: SOURCE_A });
      await expect(
        store.run('change-2', {
          content: SOURCE_B,
          outcome: providerDown(true),
        }),
      ).rejects.toThrow('provider-unavailable');
      await store.run('change-3', { content: SOURCE_A });

      expect(store.extract).toHaveBeenCalledTimes(3);
      expect(store.changes.get('change-3')?.extractedAt).toBeInstanceOf(Date);
    });

    it('does not hide a revert while the push in between has not run yet', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      store.push('change-3', 3);
      quietLogs();

      await store.run('change-1', { content: SOURCE_A });
      await store.run('change-3', { content: SOURCE_A });

      expect(store.extract).toHaveBeenCalledTimes(2);
    });

    it('is never one recorded after it', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      store.push('change-3', 3);
      quietLogs();

      await store.run('change-1');
      await store.run('change-3');
      await store.run('change-2');

      // change-2 matches change-1, which came right before it; change-3 is
      // newer and is not what it is compared with.
      expect(store.extract).toHaveBeenCalledTimes(2);
      expect(store.changes.get('change-2')?.extractedAt).toBeInstanceOf(Date);
    });

    // A stamped push delivered again after the model, prompt, locale or limit
    // changed holds a new hash. If its new extraction then comes to nothing,
    // the old stamp must not stay behind: the next identical push would read
    // "new hash, stamped" and skip a version that was never extracted.
    it.each([
      ['fails', providerDown(false)],
      ['finds no tests', { kind: 'no-tests-found' }],
      ['hits the case cap', nCases(MAX_EXTRACTED_CASES)],
    ])(
      'clears the stamp of a push delivered again with another fingerprint whose extraction %s',
      async (_label, outcome) => {
        const store = pushes();
        const first = store.push('change-1', 1);
        store.push('change-2', 2);
        quietLogs();

        await store.run('change-1', { model: 'gemini-a' });
        expect(first.extractedAt).toBeInstanceOf(Date);

        await store.run('change-1', { model: 'gemini-b', outcome });
        expect(first.extractedAt).toBeNull();

        // The extractor may be asked twice for the failed run (it retries a
        // file that holds declarations), so count what the next push adds.
        const calls = store.extract.mock.calls.length;
        await store.run('change-2', { model: 'gemini-b' });

        expect(store.extract).toHaveBeenCalledTimes(calls + 1);
        expect(store.changes.get('change-2')?.extractedAt).toBeInstanceOf(Date);
      },
    );

    it('is not a push that failed, whatever it held', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      quietLogs();

      await store.run('change-1', { outcome: providerDown(false) });
      await store.run('change-2');

      expect(store.extract).toHaveBeenCalledTimes(2);
    });

    it('is not a push whose creation time the job does not know', async () => {
      const store = pushes();
      store.push('change-1', 1);
      store.push('change-2', 2);
      quietLogs();
      const lookup = store.prisma.codeChange.findUnique.getMockImplementation();
      store.prisma.codeChange.findUnique.mockImplementation(
        async (args: { where: { id: string } }) => ({
          ...((await lookup?.(args)) as Record<string, unknown>),
          createdAt: undefined,
        }),
      );

      await store.run('change-1');
      await store.run('change-2');

      expect(store.extract).toHaveBeenCalledTimes(2);
    });
  });

  describe('an extraction is only stamped when it is complete', () => {
    it('stamps after the proposals are saved, and writes the hash before the model call', async () => {
      const store = pushes();
      const change = store.push('change-1', 1);
      quietLogs();

      await store.run('change-1');

      expect(change.sourceHash).toMatch(/^[0-9a-f]{64}$/);
      expect(change.extractedAt).toBeInstanceOf(Date);

      const [hashOrder, stampOrder] =
        store.prisma.codeChange.updateMany.mock.invocationCallOrder;
      expect(hashOrder).toBeLessThan(store.extract.mock.invocationCallOrder[0]);
      expect(
        store.prisma.extractedProposal.create.mock.invocationCallOrder[0],
      ).toBeLessThan(stampOrder);
    });

    it('stamps when every proposal was refreshed and none was created', async () => {
      const store = pushes();
      const first = store.push('change-1', 1);
      const second = store.push('change-2', 2);
      quietLogs();
      store.prisma.extractedProposal.findMany.mockImplementation(
        (args: { where: Record<string, unknown> }) =>
          Promise.resolve(
            typeof args.where.codeChangeId === 'object'
              ? [
                  {
                    id: 'open-1',
                    status: 'in_review',
                    evidenceId: 'evidence-1',
                    automationKey: 'Cart > adds an item',
                    codeChange: { id: first.id, createdAt: first.createdAt },
                  },
                ]
              : [],
          ),
      );

      await store.run('change-2', { content: SOURCE_B });

      expect(store.prisma.extractedProposal.create).not.toHaveBeenCalled();
      expect(store.prisma.extractedProposal.updateMany).toHaveBeenCalledTimes(
        1,
      );
      expect(second.extractedAt).toBeInstanceOf(Date);
    });

    it('stamps a truncated source, since extracting it again cannot see more', async () => {
      const store = pushes();
      const change = store.push('change-1', 1);
      quietLogs();

      await store.run('change-1', { truncated: true });

      expect(change.extractedAt).toBeInstanceOf(Date);
    });

    it('does not stamp an extraction that hit the case cap, so the next push extracts again', async () => {
      const store = pushes();
      const first = store.push('change-1', 1);
      const second = store.push('change-2', 2);
      quietLogs();

      await store.run('change-1', { outcome: nCases(MAX_EXTRACTED_CASES) });
      await store.run('change-2', { outcome: nCases(MAX_EXTRACTED_CASES) });

      expect(first.extractedAt).toBeNull();
      expect(first.sourceHash).toMatch(/^[0-9a-f]{64}$/);
      expect(second.extractedAt).toBeNull();
      expect(store.extract).toHaveBeenCalledTimes(2);
    });

    it('stamps an extraction one case short of the cap', async () => {
      const store = pushes();
      const change = store.push('change-1', 1);
      quietLogs();

      await store.run('change-1', {
        outcome: nCases(MAX_EXTRACTED_CASES - 1),
      });

      expect(change.extractedAt).toBeInstanceOf(Date);
    });

    it.each([
      ['the provider is unavailable', providerDown(false)],
      ['the model finds no tests', { kind: 'no-tests-found' }],
      ['no extracted case matches the request', extractedOutcome([])],
    ])('does not stamp when %s', async (_label, outcome) => {
      const store = pushes();
      const change = store.push('change-1', 1);
      quietLogs();

      await store.run('change-1', { outcome });

      expect(change.extractedAt).toBeNull();
      expect(change.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('does not stamp when the provider failure is retryable, and rethrows it', async () => {
      const store = pushes();
      const change = store.push('change-1', 1);
      quietLogs();

      await expect(
        store.run('change-1', { outcome: providerDown(true) }),
      ).rejects.toThrow('provider-unavailable:rate-limited');

      expect(change.extractedAt).toBeNull();
    });

    it('does not stamp when the credit cannot be spent', async () => {
      const store = pushes();
      const change = store.push('change-1', 1);
      quietLogs();
      store.spendCredit.mockResolvedValue(false);

      await store.run('change-1');

      expect(store.prisma.extractedProposal.create).not.toHaveBeenCalled();
      expect(change.extractedAt).toBeNull();
    });

    it('does not stamp when the daily budget is exhausted', async () => {
      const store = pushes();
      const change = store.push('change-1', 1);
      quietLogs();
      store.tryConsume.mockResolvedValue(false);

      await store.run('change-1');

      expect(store.extract).not.toHaveBeenCalled();
      expect(change.extractedAt).toBeNull();
    });

    it('does not fingerprint a source that could not be read', async () => {
      const store = pushes();
      const change = store.push('change-1', 1);
      quietLogs();
      const read = jest
        .fn()
        .mockResolvedValue({ kind: 'unavailable', reason: 'timeout' });

      await build(
        store.prisma,
        fakeSourceReader(read),
        fakeExtractor(store.extract),
      ).process({
        data: { kind: 'code-change', codeChangeId: 'change-1' },
      } as never);

      expect(store.prisma.codeChange.findMany).not.toHaveBeenCalled();
      expect(change.sourceHash).toBeNull();
    });
  });

  describe('the fingerprint never blocks an extraction', () => {
    it('extracts anyway when the previous push cannot be looked up', async () => {
      const store = pushes();
      store.push('change-1', 1);
      const [, warn] = quietLogs();
      store.prisma.codeChange.findMany.mockRejectedValue(new Error('db gone'));

      await store.run('change-1');

      expect(store.extract).toHaveBeenCalledTimes(1);
      expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('db gone'));
    });

    it('keeps the job successful when stamping fails after the proposals were saved', async () => {
      const store = pushes();
      store.push('change-1', 1);
      const [, warn] = quietLogs();
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const write = store.prisma.codeChange.updateMany.getMockImplementation();
      store.prisma.codeChange.updateMany
        .mockImplementationOnce(write as never)
        .mockRejectedValueOnce(new Error('db gone'));

      await expect(store.run('change-1')).resolves.toBeUndefined();

      expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('db gone'));
      expect(error).not.toHaveBeenCalled();
    });
  });

  describe('explicit documentation requests are not fingerprinted', () => {
    const testCaseRow = {
      id: 'case-1',
      projectId: 'project-1',
      suiteId: 'suite-1',
      automationKey: 'Cart > adds an item',
      automationFilePath: FILE_PATH,
      project: { organizationId: 'org-1', connection },
    };

    it('still extracts a document-case request for an unchanged file', async () => {
      const prisma = createPrisma();
      prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
      const extract = jest
        .fn()
        .mockResolvedValue(extractedOutcome([extractedCase()]));

      await build(prisma, fakeSourceReader(), fakeExtractor(extract)).process({
        data: { kind: 'document-case', testCaseId: 'case-1' },
      } as never);

      expect(extract).toHaveBeenCalledTimes(1);
      expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
      expect(prisma.codeChange.findMany).not.toHaveBeenCalled();
      expect(prisma.codeChange.updateMany).not.toHaveBeenCalled();
    });

    it('still extracts a document-file request for an unchanged file', async () => {
      const prisma = createPrisma();
      prisma.testCase.findUnique.mockResolvedValue({
        projectId: 'project-1',
        project: { organizationId: 'org-1', connection },
      });
      prisma.testCase.findMany.mockResolvedValue([
        { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      ]);
      const extract = jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
          ]),
        );

      await build(prisma, fakeSourceReader(), fakeExtractor(extract)).process({
        data: {
          kind: 'document-file',
          filePath: FILE_PATH,
          targets: [
            { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
          ],
        },
      } as never);

      expect(extract).toHaveBeenCalledTimes(1);
      expect(prisma.codeChange.findMany).not.toHaveBeenCalled();
      expect(prisma.codeChange.updateMany).not.toHaveBeenCalled();
    });
  });
});

describe('ExtractionProcessor — document-case job', () => {
  const testCaseRow = {
    id: 'case-1',
    projectId: 'project-1',
    suiteId: 'suite-1',
    automationKey: 'Cart > adds an item',
    automationFilePath: 'src/cart.spec.ts',
    project: { organizationId: 'org-1', connection },
  };

  it('creates a proposal targeting the documented case without a code change', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      codeChangeId: null,
      targetTestCaseId: 'case-1',
      suiteId: 'suite-1',
      status: 'in_review',
    });
  });

  it('supersedes a stale manual-review fallback proposal once a real extraction succeeds for the case', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.extractedProposal.deleteMany).toHaveBeenCalledWith({
      where: {
        targetTestCaseId: 'case-1',
        needsManualReview: true,
        status: 'in_review',
      },
    });
  });

  it('does not let a pending manual-review fallback block a fresh successful extraction from being proposed', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    prisma.extractedProposal.findFirst.mockImplementation(
      (args: { where: Record<string, unknown> }) =>
        Promise.resolve(
          args.where.needsManualReview === false
            ? null
            : { id: 'stale-fallback' },
        ),
    );
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
  });

  it('normalizes an absolute CI runner path stored on the case before reading the source', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      ...testCaseRow,
      automationFilePath: '/home/runner/work/qably/qably/src/cart.spec.ts',
    });
    const read = jest.fn().mockResolvedValue({
      kind: 'content',
      content: 'file body',
      truncated: false,
    });
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(read), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'src/cart.spec.ts' }),
    );
  });

  it('resolves the file path from the repository when the case carries none', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      ...testCaseRow,
      automationFilePath: null,
    });
    prisma.extractedProposal.findFirst
      .mockResolvedValueOnce({ codeChange: { filePath: 'src/cart.spec.ts' } })
      .mockResolvedValue(null);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({ targetTestCaseId: 'case-1' });
  });

  it('does nothing when the repository never produced that key', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      ...testCaseRow,
      automationFilePath: null,
    });
    prisma.extractedProposal.findFirst.mockResolvedValue(null);
    prisma.testCase.findFirst.mockResolvedValue(null);
    const extractor = fakeExtractor(jest.fn());

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('locates the file from the repository tree and persists it when nothing else resolves it', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      ...testCaseRow,
      automationFilePath: null,
    });
    prisma.extractedProposal.findFirst.mockResolvedValue(null);
    prisma.testCase.findFirst.mockResolvedValue(null);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );
    const testFileLocator = fakeTestFileLocator(
      jest.fn().mockResolvedValue('src/cart/cart.spec.ts'),
    );

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      fakeEntitlement(),
      fakeDailyBudget(),
      testFileLocator,
    ).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { automationFilePath: 'src/cart/cart.spec.ts' },
    });
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({ targetTestCaseId: 'case-1' });
  });

  const twoDeclarationsSource = () =>
    fakeSourceReader(
      jest.fn().mockResolvedValue({
        kind: 'content',
        content:
          "it('adds an item', () => {})\nit('removes an item', () => {})",
        truncated: false,
      }),
    );

  it('retries once with a declaration-count hint when the model first finds no tests but the file has some', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extract = jest
      .fn()
      .mockResolvedValueOnce({ kind: 'no-tests-found' })
      .mockResolvedValueOnce(extractedOutcome([extractedCase()]));
    const extractor = fakeExtractor(extract);

    await build(prisma, twoDeclarationsSource(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(extract).toHaveBeenCalledTimes(2);
    const retryCall = extract.mock.calls[1] as [
      { declarationCountHint?: number },
    ];
    expect(retryCall[0]).toMatchObject({ declarationCountHint: 2 });
    expect(prisma.extractedProposal.create).toHaveBeenCalled();
  });

  it('marks the case failed with extraction-incomplete, not no-tests-found, when the retry still finds nothing', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extract = jest.fn().mockResolvedValue({ kind: 'no-tests-found' });
    const extractor = fakeExtractor(extract);

    await build(prisma, twoDeclarationsSource(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(extract).toHaveBeenCalledTimes(2);
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { data: { documentationSkipReason: string } },
    ];
    expect(data.documentationSkipReason).toBe('extraction-incomplete');
  });

  it('never retries and marks the case failed with no-tests-found when the file has no test declarations at all', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extract = jest.fn().mockResolvedValue({ kind: 'no-tests-found' });
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(extract).toHaveBeenCalledTimes(1);
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { data: { documentationSkipReason: string } },
    ];
    expect(data.documentationSkipReason).toBe('no-tests-found');
  });

  it('appends an observation noting how many cases were extracted out of how many declarations were found', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, twoDeclarationsSource(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data?.observations).toEqual([
      'Aeris extracted 1 of 2 test declarations found in this file.',
    ]);
  });

  it('skips when a proposal is already pending for the case (defense in depth)', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    prisma.extractedProposal.findFirst.mockResolvedValue({ id: 'pending' });
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('marks the case failed and creates no proposal when the source is unavailable, so it stays documentable', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const sourceReader = fakeSourceReader(
      jest.fn().mockResolvedValue({ kind: 'unavailable', reason: 'http-404' }),
    );
    const extractor = fakeExtractor(jest.fn());

    await build(prisma, sourceReader, extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.evidence.create).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.testCase.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['case-1'] },
        documentationSource: { not: 'human' },
        OR: [
          { documentationQueuedAt: { not: null } },
          { documentationOutcome: null },
          { documentationOutcome: 'failed' },
        ],
      },
      data: {
        documentationOutcome: 'failed',
        documentationSkipReason: 'http-404',
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
      },
    });
  });

  it.each(['timeout', 'fetch-failed', 'http-401', 'http-403'])(
    'creates no proposal for the source-unavailable reason %s',
    async (reason) => {
      const prisma = createPrisma();
      prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
      const sourceReader = fakeSourceReader(
        jest.fn().mockResolvedValue({ kind: 'unavailable', reason }),
      );
      const extractor = fakeExtractor(jest.fn());

      await build(prisma, sourceReader, extractor).process({
        data: { kind: 'document-case', testCaseId: 'case-1' },
      } as never);

      expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    },
  );

  it('creates no proposal and marks the case failed when there is no repository connection', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      ...testCaseRow,
      project: { organizationId: 'org-1', connection: null },
    });
    const extractor = fakeExtractor(jest.fn());

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.testCase.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['case-1'] },
        documentationSource: { not: 'human' },
        OR: [
          { documentationQueuedAt: { not: null } },
          { documentationOutcome: null },
          { documentationOutcome: 'failed' },
        ],
      },
      data: {
        documentationOutcome: 'failed',
        documentationSkipReason: 'no-connection',
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
      },
    });
  });

  it('marks the case failed, creating no proposal, when the model reports no tests found', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { where: { id: unknown }; data: { documentationSkipReason: string } },
    ];
    expect(where.id).toEqual({ in: ['case-1'] });
    expect(data.documentationSkipReason).toBe('no-tests-found');
  });

  it('marks the case failed, creating no proposal, when extraction yields no case matching the automationKey', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > a different test' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { where: { id: unknown }; data: { documentationSkipReason: string } },
    ];
    expect(where.id).toEqual({ in: ['case-1'] });
    expect(data.documentationSkipReason).toBe('automation-key-not-found');
  });
});

describe('ExtractionProcessor — document-file job', () => {
  const firstTargetRow = {
    projectId: 'project-1',
    project: { organizationId: 'org-1', connection },
  };

  const targets = [
    { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
    { testCaseId: 'case-2', automationKey: 'Cart > removes an item' },
  ];

  function documentFileJob(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        kind: 'document-file',
        filePath: 'src/cart.spec.ts',
        targets,
        ...overrides,
      },
    } as never;
  }

  it('asks the extractor for the suite summary bonus by default when the job carries no explicit flag', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const extract = jest
      .fn()
      .mockResolvedValue(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
          extractedCase({ automationKey: 'Cart > removes an item' }),
        ]),
      );
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledWith(
      expect.objectContaining({ requestSuiteSummary: true }),
    );
  });

  it('tells the extractor to skip the suite summary bonus when a standalone suite job already covers it', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const extract = jest
      .fn()
      .mockResolvedValue(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
          extractedCase({ automationKey: 'Cart > removes an item' }),
        ]),
      );
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob({ requestSuiteSummary: false }),
    );

    expect(extract).toHaveBeenCalledWith(
      expect.objectContaining({ requestSuiteSummary: false }),
    );
  });

  it('normalizes an absolute CI runner file path before reading the source', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const read = jest.fn().mockResolvedValue({
      kind: 'content',
      content: 'file body',
      truncated: false,
    });
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
            extractedCase({ automationKey: 'Cart > removes an item' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(read), extractor).process(
      documentFileJob({
        filePath: '/home/runner/work/qably/qably/src/cart.spec.ts',
      }),
    );

    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'src/cart.spec.ts' }),
    );
  });

  it('writes the documentation directly onto each matched case, creating no proposal', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(
        extractedOutcome([
          extractedCase({
            automationKey: 'Cart > adds an item',
            title: 'Adds an item',
          }),
          extractedCase({
            automationKey: 'Cart > removes an item',
            title: 'Removes an item',
          }),
        ]),
      ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.testCaseVersion.create).toHaveBeenCalledTimes(2);
    expect(prisma.testCase.update).toHaveBeenCalledTimes(2);

    const versionCalls = prisma.testCaseVersion.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    expect(versionCalls.map(([call]) => call.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          testCaseId: 'case-1',
          title: 'Adds an item',
        }),
        expect.objectContaining({
          testCaseId: 'case-2',
          title: 'Removes an item',
        }),
      ]),
    );

    const caseUpdateCalls = prisma.testCase.update.mock.calls as [
      { where: { id: string }; data: Record<string, unknown> },
    ][];
    expect(caseUpdateCalls.map(([call]) => [call.where.id, call.data])).toEqual(
      expect.arrayContaining([
        ['case-1', expect.objectContaining({ documentationSource: 'aeris' })],
        ['case-2', expect.objectContaining({ documentationSource: 'aeris' })],
      ]),
    );
  });

  it('supersedes a stale manual-review fallback proposal for each case it successfully documents directly', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
            extractedCase({ automationKey: 'Cart > removes an item' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    const deleteCalls = prisma.extractedProposal.deleteMany.mock.calls as [
      { where: Record<string, unknown> },
    ][];
    expect(deleteCalls.map(([call]) => call.where)).toEqual(
      expect.arrayContaining([
        {
          targetTestCaseId: 'case-1',
          needsManualReview: true,
          status: 'in_review',
        },
        {
          targetTestCaseId: 'case-2',
          needsManualReview: true,
          status: 'in_review',
        },
      ]),
    );
  });

  it('does not create a second version but still clears queuedAt when the job is redelivered and the current version already matches exactly', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    const documented = extractedCase({ automationKey: 'Cart > adds an item' });
    prisma.testCase.findMany.mockResolvedValue([
      {
        id: 'case-1',
        suiteId: 'suite-1',
        documentationSource: 'aeris',
        currentVersion: {
          title: documented.title,
          objective: documented.objective,
          preconditions: documented.preconditions,
          steps: documented.steps,
          expectedResult: documented.expectedResult,
          priority: documented.priority,
          locale: null,
        },
      },
    ]);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([documented])),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob({ targets: [targets[0]] }),
    );

    expect(prisma.testCaseVersion.create).not.toHaveBeenCalled();
    expect(prisma.testCase.update).toHaveBeenCalledTimes(1);
    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { documentationQueuedAt: null },
    });
  });

  it('does create a new version on redelivery when the extracted content actually changed', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    const documented = extractedCase({
      automationKey: 'Cart > adds an item',
      title: 'Adds two items to the cart',
    });
    prisma.testCase.findMany.mockResolvedValue([
      {
        id: 'case-1',
        suiteId: 'suite-1',
        documentationSource: 'aeris',
        currentVersion: {
          title: 'Adds an item to the cart',
          objective: documented.objective,
          preconditions: documented.preconditions,
          steps: documented.steps,
          expectedResult: documented.expectedResult,
          priority: documented.priority,
          locale: null,
        },
      },
    ]);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([documented])),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob({ targets: [targets[0]] }),
    );

    expect(prisma.testCaseVersion.create).toHaveBeenCalledTimes(1);
  });

  it('leaves the case state untouched (still draft) when writing documentation directly', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob({ targets: [targets[0]] }),
    );

    const [call] = prisma.testCase.update.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    expect(call[0].data).not.toHaveProperty('state');
  });

  it('skips a case whose documentation source is human, counts it, and leaves its stored documentation untouched', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'human' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
            extractedCase({ automationKey: 'Cart > removes an item' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(prisma.testCase.update).toHaveBeenCalledTimes(2);
    expect(prisma.testCase.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'case-2' } }),
    );
    expect(prisma.testCaseVersion.create).toHaveBeenCalledTimes(1);

    const humanUpdate = (
      prisma.testCase.update.mock.calls as [
        { where: { id: string }; data: Record<string, unknown> },
      ][]
    ).find(([call]) => call.where.id === 'case-1');
    expect(humanUpdate?.[0].data).toEqual({
      documentationOutcome: 'skipped',
      documentationSkipReason: 'human-documented',
      documentationOutcomeAt: expect.any(Date) as Date,
      documentationQueuedAt: null,
    });
  });

  it('spends exactly one credit for the whole chunk, not one per matched case', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1' },
      { id: 'case-2', suiteId: 'suite-2' },
    ]);
    const spendCredit = jest.fn().mockResolvedValue(true);
    const entitlement = fakeEntitlement(
      jest.fn().mockResolvedValue(true),
      spendCredit,
    );
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
            extractedCase({ automationKey: 'Cart > removes an item' }),
          ]),
        ),
    );

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      entitlement,
    ).process(documentFileJob());

    expect(spendCredit).toHaveBeenCalledTimes(1);
  });

  it('marks only the unmatched target case failed, while the matched one is documented directly, creating no proposal', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { where: { id: unknown }; data: { documentationSkipReason: string } },
    ];
    expect(where.id).toEqual({ in: ['case-2'] });
    expect(data.documentationSkipReason).toBe('automation-key-not-found');
    expect(prisma.testCase.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'case-1' } }),
    );
  });

  it('matches a target stored with the jest-junit space join when the model answers with the vitest separator', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob({
        targets: [{ testCaseId: 'case-1', automationKey: 'Cart adds an item' }],
      }),
    );

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.testCase.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'case-1' } }),
    );
  });

  it('marks every target in the chunk failed with no-tests-found, creating no proposal', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { where: { id: unknown }; data: { documentationSkipReason: string } },
    ];
    expect(where.id).toEqual({ in: ['case-1', 'case-2'] });
    expect(data.documentationSkipReason).toBe('no-tests-found');
  });

  it('marks every target failed with extraction-incomplete when the file has declarations the model could not extract, creating no proposal', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );
    const sourceReader = fakeSourceReader(
      jest.fn().mockResolvedValue({
        kind: 'content',
        content:
          "it('adds an item', () => {})\nit('removes an item', () => {})",
        truncated: false,
      }),
    );

    await build(prisma, sourceReader, extractor).process(documentFileJob());

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { where: { id: unknown }; data: { documentationSkipReason: string } },
    ];
    expect(where.id).toEqual({ in: ['case-1', 'case-2'] });
    expect(data.documentationSkipReason).toBe('extraction-incomplete');
  });

  it('retries a targeted extraction once with the same target keys and the file-wide declaration count', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const extract = jest
      .fn()
      .mockResolvedValueOnce({ kind: 'no-tests-found' })
      .mockResolvedValueOnce(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
          extractedCase({
            automationKey: 'Cart > removes an item',
            title: 'Removes an item',
          }),
        ]),
      );
    const sourceReader = fakeSourceReader(
      jest.fn().mockResolvedValue({
        kind: 'content',
        content:
          "it('adds an item', () => {})\nit('removes an item', () => {})\nit('clears the cart', () => {})",
        truncated: false,
      }),
    );

    await build(prisma, sourceReader, fakeExtractor(extract)).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledTimes(2);
    const [firstArgs] = extract.mock.calls[0] as [
      { targetAutomationKeys?: string[]; declarationCountHint?: number },
    ];
    const [retryArgs] = extract.mock.calls[1] as [
      { targetAutomationKeys?: string[]; declarationCountHint?: number },
    ];
    expect(firstArgs.declarationCountHint).toBeUndefined();
    expect(retryArgs.targetAutomationKeys).toEqual([
      'Cart > adds an item',
      'Cart > removes an item',
    ]);
    expect(retryArgs.declarationCountHint).toBe(3);
    expect(prisma.testCaseVersion.create).toHaveBeenCalledTimes(2);
  });

  it('creates no manual-review proposal for any target when the project has no repository connection', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      ...firstTargetRow,
      project: { organizationId: 'org-1', connection: null },
    });
    const extractSpy = jest.fn();

    await build(prisma, fakeSourceReader(), fakeExtractor(extractSpy)).process(
      documentFileJob(),
    );

    expect(extractSpy).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('marks every target failed without calling the provider when the organization is not entitled, creating no proposal', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    const extractSpy = jest.fn();
    const entitlement = fakeEntitlement(jest.fn().mockResolvedValue(false));

    await build(
      prisma,
      fakeSourceReader(),
      fakeExtractor(extractSpy),
      fakeEncryption(),
      entitlement,
    ).process(documentFileJob());

    expect(extractSpy).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { where: { id: unknown }; data: { documentationSkipReason: string } },
    ];
    expect(where.id).toEqual({ in: ['case-1', 'case-2'] });
    expect(data.documentationSkipReason).toBe('ai-not-enabled');
  });

  it('does nothing when the job carries no targets', async () => {
    const prisma = createPrisma();
    const extractSpy = jest.fn();

    await build(prisma, fakeSourceReader(), fakeExtractor(extractSpy)).process(
      documentFileJob({ targets: [] }),
    );

    expect(prisma.testCase.findUnique).not.toHaveBeenCalled();
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('does nothing when the first target case no longer exists', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(null);
    const extractSpy = jest.fn();

    await build(prisma, fakeSourceReader(), fakeExtractor(extractSpy)).process(
      documentFileJob(),
    );

    expect(extractSpy).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('locks the target case rows before writing their documentation, so two chunks cannot race the same case', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
            extractedCase({ automationKey: 'Cart > removes an item' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    const lockCall = (
      prisma.$executeRawUnsafe.mock.calls as [string, ...string[]][]
    ).find(([sql]) => sql.includes('FOR NO KEY UPDATE'));
    expect(lockCall).toBeDefined();
    expect(lockCall?.[0]).toContain('test_case');
    expect(lockCall?.slice(1)).toEqual(['case-1', 'case-2']);
    expect(prisma.$executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.testCaseVersion.create.mock.invocationCallOrder[0],
    );
  });

  it('marks every target failed with quota-exhausted without calling the provider when the daily budget is spent, creating no proposal', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    const extractSpy = jest.fn();

    await build(
      prisma,
      fakeSourceReader(),
      fakeExtractor(extractSpy),
      fakeEncryption(),
      fakeEntitlement(),
      fakeDailyBudget(jest.fn().mockResolvedValue(false)),
    ).process(documentFileJob());

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { where: { id: unknown }; data: { documentationSkipReason: string } },
    ];
    expect(where.id).toEqual({ in: ['case-1', 'case-2'] });
    expect(data.documentationSkipReason).toBe('quota-exhausted');
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('does not spend a budget slot when the source file cannot be read', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    const tryConsume = jest.fn().mockResolvedValue(true);

    await build(
      prisma,
      fakeSourceReader(
        jest
          .fn()
          .mockResolvedValue({ kind: 'unavailable', reason: 'http-404' }),
      ),
      fakeExtractor(jest.fn()),
      fakeEncryption(),
      fakeEntitlement(),
      fakeDailyBudget(tryConsume),
    ).process(documentFileJob());

    expect(tryConsume).not.toHaveBeenCalled();
  });
});

describe('ExtractionProcessor — document-file documentation state', () => {
  const firstTargetRow = {
    projectId: 'project-1',
    project: { organizationId: 'org-1', connection },
  };

  const targets = [
    { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
    { testCaseId: 'case-2', automationKey: 'Cart > removes an item' },
  ];

  function documentFileJob(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        kind: 'document-file',
        filePath: 'src/cart.spec.ts',
        targets,
        ...overrides,
      },
    } as never;
  }

  it('writes documentationOutcome=complete and clears queuedAt when every required field is present', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
            extractedCase({ automationKey: 'Cart > removes an item' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    const caseUpdateCalls = prisma.testCase.update.mock.calls as [
      { where: { id: string }; data: Record<string, unknown> },
    ][];
    expect(caseUpdateCalls).toHaveLength(2);
    for (const [call] of caseUpdateCalls) {
      expect(call.data).toMatchObject({
        documentationOutcome: 'complete',
        documentationMissing: [],
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
        documentationSkipReason: null,
      });
    }
  });

  it('writes documentationOutcome=incomplete with the missing fields when the extracted case lacks required content', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(
        extractedOutcome([
          extractedCase({
            automationKey: 'Cart > adds an item',
            objective: '',
            expectedResult: '',
          }),
        ]),
      ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob({ targets: [targets[0]] }),
    );

    const [call] = prisma.testCase.update.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    expect(call[0].data).toMatchObject({
      documentationOutcome: 'incomplete',
      documentationMissing: expect.arrayContaining([
        'objective',
        'expectedResult',
      ]) as string[],
    });
  });

  it('writes documentationOutcome=failed with the reason on every target that falls back, excluding human rows and rows this job no longer owns', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      ...firstTargetRow,
      project: { organizationId: 'org-1', connection: null },
    });

    await build(prisma, fakeSourceReader(), fakeExtractor(jest.fn())).process(
      documentFileJob(),
    );

    expect(prisma.testCase.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['case-1', 'case-2'] },
        documentationSource: { not: 'human' },
        OR: [
          { documentationQueuedAt: { not: null } },
          { documentationOutcome: null },
          { documentationOutcome: 'failed' },
        ],
      },
      data: {
        documentationOutcome: 'failed',
        documentationSkipReason: 'no-connection',
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
      },
    });
  });

  it('never lets a failure recording clobber a human edit', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      ...firstTargetRow,
      project: { organizationId: 'org-1', connection: null },
    });

    await build(prisma, fakeSourceReader(), fakeExtractor(jest.fn())).process(
      documentFileJob(),
    );

    const [call] = prisma.testCase.updateMany.mock.calls as [
      { where: Record<string, unknown> },
    ][];
    expect(call[0].where.documentationSource).toEqual({ not: 'human' });
  });

  it('adds no incomplete note when every target matched, regardless of how many declarations the file has', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const sourceReader = fakeSourceReader(
      jest.fn().mockResolvedValue({
        kind: 'content',
        content:
          "it('a', () => {})\nit('b', () => {})\nit('c', () => {})\nit('d', () => {})",
        truncated: false,
      }),
    );
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
            extractedCase({ automationKey: 'Cart > removes an item' }),
          ]),
        ),
    );

    await build(prisma, sourceReader, extractor).process(documentFileJob());

    const caseUpdateCalls = prisma.testCase.update.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    for (const [call] of caseUpdateCalls) {
      expect(call.data).not.toHaveProperty('observations');
    }
  });

  it('adds a note fed with matched-of-target counts when the retry still cannot find every target', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const extract = jest
      .fn()
      .mockResolvedValueOnce(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
        ]),
      )
      .mockResolvedValueOnce({ kind: 'no-tests-found' });
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledTimes(2);
    const case1Update = (
      prisma.testCase.update.mock.calls as [
        { where: { id: string }; data: Record<string, unknown> },
      ][]
    ).find(([call]) => call.where.id === 'case-1');
    expect(case1Update?.[0].data.observations).toEqual([
      'Aeris documented 1 of 2 test cases requested in this run.',
    ]);
    expect(case1Update?.[0].data.observations).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('declarations found in this file'),
      ]),
    );

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { where: { id: unknown }; data: { documentationSkipReason: string } },
    ];
    expect(where.id).toEqual({ in: ['case-2'] });
    expect(data.documentationSkipReason).toBe('automation-key-not-found');
  });

  it('retries once with only the unmatched automation key, documenting both targets when the retry finds the rest', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const extract = jest
      .fn()
      .mockResolvedValueOnce(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
        ]),
      )
      .mockResolvedValueOnce(
        extractedOutcome([
          extractedCase({
            automationKey: 'Cart > removes an item',
            title: 'Removes an item',
          }),
        ]),
      );
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledTimes(2);
    const [retryArgs] = extract.mock.calls[1] as [
      { targetAutomationKeys?: string[]; declarationCountHint?: number },
    ];
    expect(retryArgs.targetAutomationKeys).toEqual(['Cart > removes an item']);
    expect(retryArgs.declarationCountHint).toBeUndefined();

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.testCaseVersion.create).toHaveBeenCalledTimes(2);
  });

  it('does not call the extractor a second time when every target matched on the first pass', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const extract = jest
      .fn()
      .mockResolvedValue(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
          extractedCase({ automationKey: 'Cart > removes an item' }),
        ]),
      );
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledTimes(1);
  });

  it('falls back only the target the retry could not find either, without throwing on a retry provider failure', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const extract = jest
      .fn()
      .mockResolvedValueOnce(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
        ]),
      )
      .mockResolvedValueOnce({
        kind: 'provider-unavailable',
        reason: 'rate-limited',
        retryable: true,
      });
    const extractor = fakeExtractor(extract);

    await expect(
      build(prisma, fakeSourceReader(), extractor).process(documentFileJob()),
    ).resolves.toBeUndefined();

    expect(extract).toHaveBeenCalledTimes(2);
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    const [{ where, data }] = prisma.testCase.updateMany.mock.calls[0] as [
      { where: { id: unknown }; data: { documentationSkipReason: string } },
    ];
    expect(where.id).toEqual({ in: ['case-2'] });
    expect(data.documentationSkipReason).toBe('automation-key-not-found');
    expect(prisma.testCaseVersion.create).toHaveBeenCalledTimes(1);
  });

  it('spends the credit and daily budget only once even though the retry calls the extractor twice', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);
    const tryConsume = jest.fn().mockResolvedValue(true);
    const spendCredit = jest.fn().mockResolvedValue(true);
    const extract = jest
      .fn()
      .mockResolvedValueOnce(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
        ]),
      )
      .mockResolvedValueOnce(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > removes an item' }),
        ]),
      );
    const extractor = fakeExtractor(extract);

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      fakeEntitlement(jest.fn().mockResolvedValue(true), spendCredit),
      fakeDailyBudget(tryConsume),
    ).process(documentFileJob());

    expect(tryConsume).toHaveBeenCalledTimes(1);
    expect(spendCredit).toHaveBeenCalledTimes(1);
  });
});

describe('ExtractionProcessor — document-file tag-first matching', () => {
  const firstTargetRow = {
    projectId: 'project-1',
    project: { organizationId: 'org-1', connection },
  };

  // testCaseId order is 'case-1' < 'case-2' < 'case-3', matching
  // buildTargetManifest's ascending sort, so manifest1 = T1=case-1,
  // T2=case-2, T3=case-3.
  const targets = [
    { testCaseId: 'case-1', automationKey: 'Key A' },
    { testCaseId: 'case-2', automationKey: 'Key B' },
    { testCaseId: 'case-3', automationKey: 'Key C' },
  ];

  function documentFileJob(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        kind: 'document-file',
        filePath: 'src/cart.spec.ts',
        targets,
        ...overrides,
      },
    } as never;
  }

  it('renumbers the retry manifest from T1 for only the still-unmatched subset, independent of the original numbering', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-3', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);

    // Round 1: only T2 (target case-2) is cited, and correctly, so case-1
    // and case-3 stay unmatched (their keys are garbage, no tag cited).
    const extract = jest
      .fn()
      .mockResolvedValueOnce(
        extractedOutcome([
          extractedCase({
            automationKey: 'garbage that matches nothing',
            targetRef: 'T2',
            title: 'Matched via tag T2',
          }),
        ]),
      )
      // Retry manifest is built from [case-1, case-3] only: sorted by
      // testCaseId, that's T1=case-1, T2=case-3. Citing "T2" here must
      // resolve to case-3, NOT to whatever T2 meant in round 1 (case-2).
      .mockResolvedValueOnce(
        extractedOutcome([
          extractedCase({
            automationKey: 'still garbage',
            targetRef: 'T2',
            title: 'Matched via retry tag T2',
          }),
        ]),
      );
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledTimes(2);
    const [retryArgs] = extract.mock.calls[1] as [
      { targetAutomationKeys?: string[] },
    ];
    // Retry only re-requests the still-unmatched targets (case-1, case-3).
    expect(retryArgs.targetAutomationKeys).toEqual(['Key A', 'Key C']);

    const versionCalls = prisma.testCaseVersion.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    const byTestCaseId = new Map(
      versionCalls.map(([call]) => [call.data.testCaseId, call.data.title]),
    );
    expect(byTestCaseId.get('case-2')).toBe('Matched via tag T2');
    expect(byTestCaseId.get('case-3')).toBe('Matched via retry tag T2');
    expect(byTestCaseId.has('case-1')).toBe(false);
  });

  it('keeps the prompt tag order and the resolution manifest in agreement even when ctx.targets arrives in non-testCaseId order', async () => {
    // Regression: ctx.targets reflects Prisma's findMany order (no
    // explicit orderBy upstream), which need not be testCaseId-ascending.
    // buildTargetManifest always sorts by testCaseId; the prompt side must
    // sort the same way before deriving targetAutomationKeys, or "T1" shown
    // to the model and "T1" resolved by the manifest mean different targets.
    const scrambledTargets = [
      { testCaseId: 'case-3', automationKey: 'Key C' },
      { testCaseId: 'case-1', automationKey: 'Key A' },
      { testCaseId: 'case-2', automationKey: 'Key B' },
    ];
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-3', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);

    // All three targets are cited by tag in round 1, so no retry round
    // happens — this isolates the assertion to round 1's own agreement.
    const extract = jest.fn().mockResolvedValueOnce(
      extractedOutcome([
        extractedCase({
          automationKey: 'garbage 1',
          targetRef: 'T1',
          title: 'Cites T1',
        }),
        extractedCase({
          automationKey: 'garbage 2',
          targetRef: 'T2',
          title: 'Cites T2',
        }),
        extractedCase({
          automationKey: 'garbage 3',
          targetRef: 'T3',
          title: 'Cites T3',
        }),
      ]),
    );
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob({ targets: scrambledTargets }),
    );

    expect(extract).toHaveBeenCalledTimes(1);
    const [callArgs] = extract.mock.calls[0] as [
      { targetAutomationKeys?: string[] },
    ];
    // The prompt must show tags in testCaseId-sorted order — the same
    // order buildTargetManifest uses — not raw ctx.targets array order.
    expect(callArgs.targetAutomationKeys).toEqual(['Key A', 'Key B', 'Key C']);

    const versionCalls = prisma.testCaseVersion.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    const titleByTestCaseId = new Map(
      versionCalls.map(([call]) => [call.data.testCaseId, call.data.title]),
    );
    // T1/T2/T3 in sorted order are case-1/case-2/case-3 (Key A/B/C) — never
    // case-3/case-1/case-2, which is what a naive "T{index in ctx.targets}"
    // reading (scrambledTargets' own array order) would have bound them to.
    expect(titleByTestCaseId.get('case-1')).toBe('Cites T1');
    expect(titleByTestCaseId.get('case-2')).toBe('Cites T2');
    expect(titleByTestCaseId.get('case-3')).toBe('Cites T3');
  });

  it('honors a tag citation over a raw-automationKey collision, since tag resolution runs before any dedupe', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-3', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);

    const sharedRawKey = 'duplicated raw automationKey';
    const extract = jest.fn().mockResolvedValue(
      extractedOutcome([
        // No tag, matches nothing by key either (Key A/B/C are the real
        // targets) — present only to collide on the raw automationKey.
        extractedCase({ automationKey: sharedRawKey, title: 'First, no tag' }),
        // Same raw automationKey, but cites T2 (case-2). If tag resolution
        // ran AFTER a raw-key dedupe (the old order), this case would have
        // been dropped before its tag was ever read.
        extractedCase({
          automationKey: sharedRawKey,
          targetRef: 'T2',
          title: 'Second, cites T2',
        }),
        extractedCase({ automationKey: 'Key C', title: 'Matched by key' }),
      ]),
    );
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledTimes(2); // case-1 still unmatched, retry fires
    const versionCalls = prisma.testCaseVersion.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    const byTestCaseId = new Map(
      versionCalls.map(([call]) => [call.data.testCaseId, call.data.title]),
    );
    expect(byTestCaseId.get('case-2')).toBe('Second, cites T2');
    expect(byTestCaseId.get('case-3')).toBe('Matched by key');
  });

  it('assesses documentation completeness using the target automationKey, never the raw case key or the tag string, when a tag match has a drifted key', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-3', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);

    const extract = jest.fn().mockResolvedValue(
      extractedOutcome([
        extractedCase({ automationKey: 'Key A', title: 'A' }),
        extractedCase({
          automationKey: 'T3: nonsense, not "Key B" or "Key C"',
          targetRef: 'T2',
          title: 'B via tag',
        }),
        extractedCase({ automationKey: 'Key C', title: 'C' }),
      ]),
    );
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    // Round 1 matches all three targets (no retry needed).
    expect(extract).toHaveBeenCalledTimes(1);
    const caseUpdateCalls = prisma.testCase.update.mock.calls as [
      { where: { id: string }; data: Record<string, unknown> },
    ][];
    const case2Update = caseUpdateCalls.find(
      ([call]) => call.where.id === 'case-2',
    );
    // documentationOutcome/documentationMissing come from
    // assessCaseDocumentation, which is fed target.automationKey ("Key B"),
    // not the drifted raw case key and never the "T2" tag string. A title
    // + objective + steps + expectedResult all present means "complete"
    // regardless of what the raw key looked like.
    expect(case2Update?.[0].data).toMatchObject({
      documentationOutcome: 'complete',
    });
  });
});

describe('ExtractionProcessor — resilience', () => {
  it('lands an uncaught error (e.g. token decryption throwing) in the manual-review fallback', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockResolvedValue({
      ...codeChangeRow,
      project: {
        organizationId: 'org-1',
        connection: { ...connection, encryptedAccessToken: 'enc:token' },
      },
    });
    const decrypt = jest.fn().mockImplementation(() => {
      throw new Error('Malformed encrypted payload');
    });
    const extractSpy = jest.fn();
    const extractor = fakeExtractor(extractSpy);

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(decrypt),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(extractSpy).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });
});

describe('ExtractionProcessor — retryable provider failures', () => {
  it('lets a retryable provider failure propagate for BullMQ to retry, instead of falling back immediately', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'provider-unavailable',
        reason: 'provider-overloaded',
        retryable: true,
      }),
    );

    await expect(
      build(prisma, fakeSourceReader(), extractor).process({
        data: { kind: 'code-change', codeChangeId: 'change-1' },
        attemptsStarted: 1,
        opts: { attempts: 3 },
      } as never),
    ).rejects.toThrow();

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('falls back to manual review on the final attempt even when the failure is retryable', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'provider-unavailable',
        reason: 'provider-overloaded',
        retryable: true,
      }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
      attemptsStarted: 3,
      opts: { attempts: 3 },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('falls back immediately for a non-retryable provider failure, even on the first attempt', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'provider-unavailable',
        reason: 'invalid-credentials',
        retryable: false,
      }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
      attemptsStarted: 1,
      opts: { attempts: 3 },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('treats a job with no attempt metadata as a final attempt, falling back rather than throwing', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'provider-unavailable',
        reason: 'provider-overloaded',
        retryable: true,
      }),
    );

    await expect(
      build(prisma, fakeSourceReader(), extractor).process({
        data: { kind: 'code-change', codeChangeId: 'change-1' },
      } as never),
    ).resolves.toBeUndefined();

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('applies the same retry-vs-fallback rule to a document-file job', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue({
      projectId: 'project-1',
      project: { organizationId: 'org-1', connection },
    });
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'provider-unavailable',
        reason: 'rate-limited',
        retryable: true,
      }),
    );
    const targets = [
      { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
    ];

    await expect(
      build(prisma, fakeSourceReader(), extractor).process({
        data: { kind: 'document-file', filePath: 'src/cart.spec.ts', targets },
        attemptsStarted: 1,
        opts: { attempts: 3 },
      } as never),
    ).rejects.toThrow();

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('charges the daily budget on the first attempt', async () => {
    const prisma = createPrisma();
    const tryConsume = jest.fn().mockResolvedValue(true);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      fakeEntitlement(),
      fakeDailyBudget(tryConsume),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
      attemptsStarted: 1,
      opts: { attempts: 3 },
    } as never);

    expect(tryConsume).toHaveBeenCalledTimes(1);
  });

  it('does not re-charge the daily budget on a retry of the same job, so a provider outage cannot burn through the org cap 3x for one extraction', async () => {
    const prisma = createPrisma();
    const tryConsume = jest.fn().mockResolvedValue(true);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
    );

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      fakeEntitlement(),
      fakeDailyBudget(tryConsume),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
      attemptsStarted: 2,
      opts: { attempts: 3 },
    } as never);

    expect(tryConsume).not.toHaveBeenCalled();
    // The retry still proceeds (budget from attempt 1 carries forward) —
    // it isn't blocked just because the check was skipped.
    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
  });
});

describe('ExtractionProcessor — direct suite metadata and locale', () => {
  const firstTargetRow = {
    projectId: 'project-1',
    project: { organizationId: 'org-1', connection },
  };
  const targets = [
    { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
    { testCaseId: 'case-2', automationKey: 'Cart > removes an item' },
  ];
  function documentFileJob(locale = 'es') {
    return {
      data: {
        kind: 'document-file',
        filePath: 'src/cart.spec.ts',
        targets,
        locale,
      },
    } as never;
  }
  function twoMatchedCases() {
    return fakeExtractor(
      jest.fn().mockResolvedValue(
        extractedOutcome(
          [
            extractedCase({
              automationKey: 'Cart > adds an item',
              observations: ['No assertion on the total'],
            }),
            extractedCase({ automationKey: 'Cart > removes an item' }),
          ],
          {
            title: 'Carrito de compras',
            description: 'Cubre agregar y quitar artículos',
            tags: ['carrito', 'compras'],
          },
        ),
      ),
    );
  }

  it('applies the extracted suite name, description and tags directly, stamping nameSource to aeris', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);

    await build(prisma, fakeSourceReader(), twoMatchedCases()).process(
      documentFileJob(),
    );

    expect(prisma.suite.update).toHaveBeenCalledWith({
      where: { id: 'suite-1' },
      data: {
        name: 'Carrito de compras',
        description: 'Cubre agregar y quitar artículos',
        tags: ['carrito', 'compras'],
        nameSource: 'aeris',
        documentationOutcome: 'complete',
        documentationMissing: [],
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationSkipReason: null,
      },
    });
  });

  it('persists the extractor observations onto the case, and omits the key when the extractor gave none', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);

    await build(prisma, fakeSourceReader(), twoMatchedCases()).process(
      documentFileJob(),
    );

    const caseUpdateCalls = prisma.testCase.update.mock.calls as [
      { where: { id: string }; data: Record<string, unknown> },
    ][];
    const case1Update = caseUpdateCalls.find(
      ([call]) => call.where.id === 'case-1',
    );
    const case2Update = caseUpdateCalls.find(
      ([call]) => call.where.id === 'case-2',
    );

    expect(case1Update?.[0].data).toMatchObject({
      observations: ['No assertion on the total'],
    });
    expect(case2Update?.[0].data).not.toHaveProperty('observations');
  });

  it('keeps a human-added tag that Aeris did not propose, adding the new Aeris tags alongside it', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      { nameSource: 'aeris', tags: ['urgente'] },
    ]);

    await build(prisma, fakeSourceReader(), twoMatchedCases()).process(
      documentFileJob(),
    );

    expect(prisma.suite.update).toHaveBeenCalledWith({
      where: { id: 'suite-1' },
      data: {
        name: 'Carrito de compras',
        description: 'Cubre agregar y quitar artículos',
        tags: ['urgente', 'carrito', 'compras'],
        nameSource: 'aeris',
        documentationOutcome: 'complete',
        documentationMissing: [],
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationSkipReason: null,
      },
    });
  });

  it('does not duplicate a tag Aeris re-proposes that a human already added', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      { nameSource: 'ingestion', tags: ['carrito'] },
    ]);

    await build(prisma, fakeSourceReader(), twoMatchedCases()).process(
      documentFileJob(),
    );

    expect(lastCall(prisma.suite.update).data?.tags).toEqual([
      'carrito',
      'compras',
    ]);
  });

  it('does not touch the suite when the model returned no summary', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const extractor = fakeExtractor(
      jest
        .fn()
        .mockResolvedValue(
          extractedOutcome([
            extractedCase({ automationKey: 'Cart > adds an item' }),
          ]),
        ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(prisma.suite.update).not.toHaveBeenCalled();
  });

  it('does not touch the suite when the matched targets span more than one suite', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-2', documentationSource: 'ingestion' },
    ]);

    await build(prisma, fakeSourceReader(), twoMatchedCases()).process(
      documentFileJob(),
    );

    expect(prisma.suite.update).not.toHaveBeenCalled();
  });

  it('skips applying suite metadata when the suite name is already human-chosen, without failing the job or losing the case documentation', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValue([{ nameSource: 'human' }]);

    await build(prisma, fakeSourceReader(), twoMatchedCases()).process(
      documentFileJob(),
    );

    expect(prisma.suite.update).not.toHaveBeenCalled();
    expect(prisma.testCaseVersion.create).toHaveBeenCalledTimes(2);
    expect(prisma.testCase.update).toHaveBeenCalledTimes(2);
  });

  it('leaves the suite untouched and reports a skip when the proposed name collides with another suite, without losing the case documentation written in the same job', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    prisma.suite.update.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['projectId', 'name'] },
    });

    await expect(
      build(prisma, fakeSourceReader(), twoMatchedCases()).process(
        documentFileJob(),
      ),
    ).resolves.toBeUndefined();

    expect(prisma.testCaseVersion.create).toHaveBeenCalledTimes(2);
    expect(prisma.testCase.update).toHaveBeenCalledTimes(2);
    const savepointCalls = prisma.$executeRawUnsafe.mock.calls.map(
      ([sql]: [string]) => sql,
    );
    expect(savepointCalls).toEqual(
      expect.arrayContaining([
        'SAVEPOINT suite_metadata',
        'ROLLBACK TO SAVEPOINT suite_metadata',
        'RELEASE SAVEPOINT suite_metadata',
      ]),
    );
  });

  it('treats any unique violation while applying suite metadata as a name collision skip, even without constraint metadata', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    prisma.suite.update.mockRejectedValue({ code: 'P2002' });

    await expect(
      build(prisma, fakeSourceReader(), twoMatchedCases()).process(
        documentFileJob(),
      ),
    ).resolves.toBeUndefined();

    expect(prisma.testCaseVersion.create).toHaveBeenCalledTimes(2);
  });

  it('locks the suite row before reading its nameSource', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);

    await build(prisma, fakeSourceReader(), twoMatchedCases()).process(
      documentFileJob(),
    );

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      'suite-1',
    );
    expect(prisma.$queryRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.suite.update.mock.invocationCallOrder[0],
    );
  });

  it('stamps the job locale onto each documented version', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);

    await build(prisma, fakeSourceReader(), twoMatchedCases()).process(
      documentFileJob('es'),
    );

    const versionCalls = prisma.testCaseVersion.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    expect(versionCalls.map(([call]) => call.data.locale)).toEqual([
      'es',
      'es',
    ]);
  });

  it('marks the case failed with no proposal when the model reports no tests found, regardless of locale', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);

    await build(
      prisma,
      fakeSourceReader(),
      fakeExtractor(jest.fn().mockResolvedValue({ kind: 'no-tests-found' })),
    ).process(documentFileJob('en'));

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.testCase.updateMany).toHaveBeenCalled();
  });
});

describe('ExtractionProcessor — document-suite-metadata job', () => {
  function suiteMetadataJob(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        kind: 'document-suite-metadata',
        suiteId: 'suite-1',
        locale: 'en',
      },
      attemptsStarted: 1,
      opts: { attempts: 3 },
      ...overrides,
    } as never;
  }

  function suiteRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'suite-1',
      organizationId: 'org-1',
      name: 'checkout_flow',
      description: '',
      tags: [] as string[],
      nameSource: 'ingestion',
      cases: [
        { name: 'Adds an item', objective: 'Verify the cart accepts an item' },
      ],
      ...overrides,
    };
  }

  function summarizedOutcome(overrides: Record<string, unknown> = {}) {
    return {
      kind: 'summarized' as const,
      suite: {
        title: 'Checkout',
        description: 'Covers the checkout flow',
        tags: ['checkout'],
      },
      usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
      ...overrides,
    };
  }

  it('asks the summarizer with the suite name and its active/draft case titles and objectives', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    const summarizeSuite = jest.fn().mockResolvedValue(summarizedOutcome());
    const extractor = fakeExtractor(jest.fn(), summarizeSuite);

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob(),
    );

    expect(summarizeSuite).toHaveBeenCalledWith({
      suiteName: 'checkout_flow',
      cases: [
        { title: 'Adds an item', objective: 'Verify the cart accepts an item' },
      ],
      locale: 'en',
    });
  });

  it('writes the summarized name, description and tags, stamping nameSource to aeris', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    prisma.$queryRawUnsafe.mockResolvedValue([
      { name: 'checkout_flow', nameSource: 'ingestion', tags: [] },
    ]);
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue(summarizedOutcome()),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob(),
    );

    expect(prisma.suite.updateMany).toHaveBeenCalledWith({
      where: { id: 'suite-1', documentationQueuedAt: { not: null } },
      data: {
        name: 'Checkout',
        nameSource: 'aeris',
        description: 'Covers the checkout flow',
        tags: ['checkout'],
        documentationOutcome: 'complete',
        documentationMissing: [],
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
        documentationSkipReason: null,
      },
    });
  });

  it('never overwrites a human-chosen name, but still writes description and tags', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst
      .mockReset()
      .mockResolvedValue(suiteRow({ nameSource: 'human', description: '' }));
    prisma.$queryRawUnsafe.mockResolvedValue([
      { name: 'Checkout (human name)', nameSource: 'human', tags: [] },
    ]);
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue(summarizedOutcome()),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob(),
    );

    expect(prisma.suite.updateMany).toHaveBeenCalledWith({
      where: { id: 'suite-1', documentationQueuedAt: { not: null } },
      data: {
        description: 'Covers the checkout flow',
        tags: ['checkout'],
        documentationOutcome: 'complete',
        documentationMissing: [],
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
        documentationSkipReason: null,
      },
    });
  });

  it('merges a human-added tag with the newly proposed tags instead of dropping it', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    prisma.$queryRawUnsafe.mockResolvedValue([
      { name: 'checkout_flow', nameSource: 'ingestion', tags: ['urgent'] },
    ]);
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue(summarizedOutcome()),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob(),
    );

    expect(lastCall(prisma.suite.updateMany).data?.tags).toEqual([
      'urgent',
      'checkout',
    ]);
  });

  it('caps the merged tag list at 20, keeping every existing tag and only as many new Aeris tags as fit', async () => {
    const prisma = createPrisma();
    const existingTags = Array.from({ length: 18 }, (_, i) => `existing-${i}`);
    prisma.suite.findFirst
      .mockReset()
      .mockResolvedValue(suiteRow({ tags: existingTags }));
    prisma.$queryRawUnsafe.mockResolvedValue([
      { name: 'checkout_flow', nameSource: 'ingestion', tags: existingTags },
    ]);
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue(
        summarizedOutcome({
          suite: {
            title: 'Checkout',
            description: 'Covers the checkout flow',
            tags: ['new-1', 'new-2', 'new-3', 'new-4', 'new-5'],
          },
        }),
      ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob(),
    );

    const tags = lastCall(prisma.suite.updateMany).data?.tags as string[];
    expect(tags).toHaveLength(20);
    expect(tags.slice(0, 18)).toEqual(existingTags);
    expect(tags.slice(18)).toEqual(['new-1', 'new-2']);
  });

  /** Records whether each transaction committed or rolled back. */
  function trackTransactions(prisma: FakePrisma) {
    const outcomes: ('committed' | 'rolled-back')[] = [];
    prisma.$transaction.mockImplementation(
      async (run: (tx: FakePrisma) => unknown) => {
        try {
          const result = await run(prisma);
          outcomes.push('committed');
          return result;
        } catch (error) {
          outcomes.push('rolled-back');
          throw error;
        }
      },
    );
    return outcomes;
  }

  it('spends the credit, locking the organization row, before it locks the suite row', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        name: 'checkout_flow',
        nameSource: 'ingestion',
        tags: [],
        documentationQueuedAt: new Date(),
      },
    ]);
    const spendCredit = jest.fn().mockResolvedValue(true);
    const entitlement = fakeEntitlement(
      jest.fn().mockResolvedValue(true),
      spendCredit,
    );
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue(summarizedOutcome()),
    );

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      entitlement,
    ).process(suiteMetadataJob());

    const [spendOrder] = spendCredit.mock.invocationCallOrder;
    const [lockOrder] = prisma.$queryRawUnsafe.mock.invocationCallOrder;
    expect(spendOrder).toBeLessThan(lockOrder);
    expect(prisma.suite.updateMany).toHaveBeenCalled();
  });

  it('keeps no credit and writes nothing when the suite is deleted before the row lock', async () => {
    const prisma = createPrisma();
    const transactions = trackTransactions(prisma);
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    const spendCredit = jest.fn().mockResolvedValue(true);
    const entitlement = fakeEntitlement(
      jest.fn().mockResolvedValue(true),
      spendCredit,
    );
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue(summarizedOutcome()),
    );

    await expect(
      build(
        prisma,
        fakeSourceReader(),
        extractor,
        fakeEncryption(),
        entitlement,
      ).process(suiteMetadataJob()),
    ).resolves.toBeUndefined();

    // The credit is spent first, for the lock order, and rolled back with it.
    expect(spendCredit).toHaveBeenCalledTimes(1);
    expect(transactions).toEqual(['rolled-back']);
    expect(prisma.suite.update).not.toHaveBeenCalled();
    expect(prisma.suite.updateMany).not.toHaveBeenCalled();
  });

  it('keeps no credit and writes nothing when a fresher execution already cleared documentationQueuedAt', async () => {
    const prisma = createPrisma();
    const transactions = trackTransactions(prisma);
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        name: 'checkout_flow',
        nameSource: 'ingestion',
        tags: [],
        documentationQueuedAt: null,
      },
    ]);
    const spendCredit = jest.fn().mockResolvedValue(true);
    const entitlement = fakeEntitlement(
      jest.fn().mockResolvedValue(true),
      spendCredit,
    );
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue(summarizedOutcome()),
    );

    await expect(
      build(
        prisma,
        fakeSourceReader(),
        extractor,
        fakeEncryption(),
        entitlement,
      ).process(suiteMetadataJob()),
    ).resolves.toBeUndefined();

    expect(spendCredit).toHaveBeenCalledTimes(1);
    expect(transactions).toEqual(['rolled-back']);
    expect(prisma.suite.update).not.toHaveBeenCalled();
    expect(prisma.suite.updateMany).not.toHaveBeenCalled();
  });

  it('skips entirely, with a human-documented outcome, when the name is human-chosen and the suite is already fully documented', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(
      suiteRow({
        nameSource: 'human',
        description: 'Covers the checkout flow',
        tags: ['checkout'],
      }),
    );
    const summarizeSuite = jest.fn();
    const extractor = fakeExtractor(jest.fn(), summarizeSuite);

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob(),
    );

    expect(summarizeSuite).not.toHaveBeenCalled();
    expect(prisma.suite.updateMany).toHaveBeenCalledWith({
      where: { id: 'suite-1', documentationQueuedAt: { not: null } },
      data: {
        documentationOutcome: 'skipped',
        documentationSkipReason: 'human-documented',
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
      },
    });
  });

  it('still calls the summarizer when the name is human-chosen but the description is still missing', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst
      .mockReset()
      .mockResolvedValue(
        suiteRow({ nameSource: 'human', description: '', tags: ['checkout'] }),
      );
    const summarizeSuite = jest.fn().mockResolvedValue(summarizedOutcome());
    const extractor = fakeExtractor(jest.fn(), summarizeSuite);

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob(),
    );

    expect(summarizeSuite).toHaveBeenCalled();
  });

  it('does nothing when the suite no longer exists', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(null);
    const summarizeSuite = jest.fn();
    const extractor = fakeExtractor(jest.fn(), summarizeSuite);

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob(),
    );

    expect(summarizeSuite).not.toHaveBeenCalled();
    expect(prisma.suite.update).not.toHaveBeenCalled();
    expect(prisma.suite.updateMany).not.toHaveBeenCalled();
  });

  it('writes a failed outcome without calling the summarizer when the organization is not entitled', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    const summarizeSuite = jest.fn();
    const entitlement = fakeEntitlement(jest.fn().mockResolvedValue(false));

    await build(
      prisma,
      fakeSourceReader(),
      fakeExtractor(jest.fn(), summarizeSuite),
      fakeEncryption(),
      entitlement,
    ).process(suiteMetadataJob());

    expect(summarizeSuite).not.toHaveBeenCalled();
    expect(prisma.suite.updateMany).toHaveBeenCalledWith({
      where: { id: 'suite-1', documentationQueuedAt: { not: null } },
      data: {
        documentationOutcome: 'failed',
        documentationSkipReason: 'ai-not-enabled',
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
      },
    });
  });

  it('writes a failed outcome without calling the summarizer when the daily budget is spent', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    const summarizeSuite = jest.fn();

    await build(
      prisma,
      fakeSourceReader(),
      fakeExtractor(jest.fn(), summarizeSuite),
      fakeEncryption(),
      fakeEntitlement(),
      fakeDailyBudget(jest.fn().mockResolvedValue(false)),
    ).process(suiteMetadataJob());

    expect(summarizeSuite).not.toHaveBeenCalled();
    expect(prisma.suite.updateMany).toHaveBeenCalledWith({
      where: { id: 'suite-1', documentationQueuedAt: { not: null } },
      data: {
        documentationOutcome: 'failed',
        documentationSkipReason: 'quota-exhausted',
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
      },
    });
  });

  it('propagates a retryable provider failure for BullMQ to retry, instead of writing failed immediately', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue({
        kind: 'provider-unavailable',
        reason: 'provider-overloaded',
        retryable: true,
      }),
    );

    await expect(
      build(prisma, fakeSourceReader(), extractor).process(
        suiteMetadataJob({ attemptsStarted: 1, opts: { attempts: 3 } }),
      ),
    ).rejects.toThrow();

    expect(prisma.suite.updateMany).not.toHaveBeenCalled();
  });

  it('writes a failed outcome with the reason on the final attempt even when the failure is retryable', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue({
        kind: 'provider-unavailable',
        reason: 'provider-overloaded',
        retryable: true,
      }),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob({ attemptsStarted: 3, opts: { attempts: 3 } }),
    );

    expect(prisma.suite.updateMany).toHaveBeenCalledWith({
      where: { id: 'suite-1', documentationQueuedAt: { not: null } },
      data: {
        documentationOutcome: 'failed',
        documentationSkipReason: 'provider-overloaded',
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
      },
    });
  });

  it('spends exactly one credit for a successful summary', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    const spendCredit = jest.fn().mockResolvedValue(true);
    const entitlement = fakeEntitlement(
      jest.fn().mockResolvedValue(true),
      spendCredit,
    );
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue(summarizedOutcome()),
    );

    await build(
      prisma,
      fakeSourceReader(),
      extractor,
      fakeEncryption(),
      entitlement,
    ).process(suiteMetadataJob());

    expect(spendCredit).toHaveBeenCalledTimes(1);
  });

  it('handles a unique suite-name collision by keeping the previous name but still writing description and tags', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockReset().mockResolvedValue(suiteRow());
    prisma.$queryRawUnsafe.mockResolvedValue([
      { name: 'checkout_flow', nameSource: 'ingestion', tags: [] },
    ]);
    prisma.suite.updateMany.mockRejectedValueOnce({ code: 'P2002' });
    const extractor = fakeExtractor(
      jest.fn(),
      jest.fn().mockResolvedValue(summarizedOutcome()),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      suiteMetadataJob(),
    );

    const savepointCalls = prisma.$executeRawUnsafe.mock.calls.map(
      ([sql]: [string]) => sql,
    );
    expect(savepointCalls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('SAVEPOINT'),
        expect.stringContaining('ROLLBACK TO SAVEPOINT'),
      ]),
    );
    expect(prisma.suite.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'suite-1', documentationQueuedAt: { not: null } },
      data: {
        description: 'Covers the checkout flow',
        tags: ['checkout'],
        documentationOutcome: 'complete',
        documentationMissing: [],
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
        documentationSkipReason: null,
      },
    });
  });
});

describe('ExtractionProcessor — process dispatch exhaustiveness', () => {
  it('throws instead of silently routing an unrecognized job kind to suite-metadata handling', async () => {
    const prisma = createPrisma();
    const job = {
      data: { kind: 'not-a-real-kind', locale: 'en' },
      attemptsStarted: 1,
      opts: { attempts: 1 },
    } as never;

    await expect(
      build(prisma, fakeSourceReader(), fakeExtractor(jest.fn())).process(job),
    ).rejects.toThrow();

    expect(prisma.suite.findFirst).not.toHaveBeenCalled();
  });
});
