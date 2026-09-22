import { DEFAULT_LOCALE } from '@qably/i18n';
import type { AiDailyBudget } from '../ai/ai-daily-budget.service';
import type { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { SourceReader } from '../repository/source-reader';
import type { TestFileLocator } from '../repository/test-file-locator';
import type { TestCaseExtractor } from '../ai/extraction.contracts';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction-prompt';
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
  codeChange: { findUnique: jest.Mock; findFirst: jest.Mock };
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

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    codeChange: {
      findUnique: jest.fn().mockResolvedValue(codeChangeRow),
      findFirst: jest.fn().mockResolvedValue(null),
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
  return { isEntitled, spendCredit } as unknown as AiEntitlementService;
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
) {
  return new ExtractionProcessor(
    prisma as never,
    sourceReader,
    extractor,
    encryption,
    entitlement,
    dailyBudget,
    testFileLocator,
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

    const savepointCalls = prisma.$executeRawUnsafe.mock.calls.map(
      ([sql]: [string]) => sql,
    );
    expect(savepointCalls).toEqual([
      'SAVEPOINT extraction_proposal',
      'RELEASE SAVEPOINT extraction_proposal',
    ]);
    const savepointOrder = prisma.$executeRawUnsafe.mock.invocationCallOrder[0];
    const evidenceCreateOrder =
      prisma.evidence.create.mock.invocationCallOrder[0];
    const proposalCreateOrder =
      prisma.extractedProposal.create.mock.invocationCallOrder[0];
    const releaseOrder = prisma.$executeRawUnsafe.mock.invocationCallOrder[1];
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

  it('does nothing when the model reports no tests found', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.update).not.toHaveBeenCalled();
  });

  it('falls back to a manual-review proposal when the project has no connection', async () => {
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

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      projectId: 'project-1',
      codeChangeId: 'change-1',
      evidenceId: 'evidence-blob-1',
      title: 'src/cart.spec.ts',
      needsManualReview: true,
      status: 'in_review',
    });
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('falls back to quota-exhausted without calling the provider when the daily budget is spent', async () => {
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

    expect(lastCall(prisma.extractedProposal.create).data).toMatchObject({
      needsManualReview: true,
      objective: 'quota-exhausted',
    });
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

  it('falls back to a manual-review proposal when the source is unavailable', async () => {
    const prisma = createPrisma();
    const sourceReader = fakeSourceReader(
      jest.fn().mockResolvedValue({ kind: 'unavailable', reason: 'http-404' }),
    );
    const extractSpy = jest.fn();
    const extractor = fakeExtractor(extractSpy);

    await build(prisma, sourceReader, extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'http-404',
    });
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('falls back to a manual-review proposal when the provider is unavailable', async () => {
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

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'invalid-credentials',
    });
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

  it('falls back to manual review without calling the provider when the organization is not entitled', async () => {
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
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'ai-not-enabled',
    });
  });

  it('falls back to manual review when the credit decrement fails after a successful extraction', async () => {
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
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'ai-not-enabled',
    });
  });

  it('spends the credit inside the persisting transaction so a failed persist would roll the credit back too', async () => {
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
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'extraction-failed',
    });
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
    const updateCall = lastCall(prisma.extractedProposal.update);
    expect(updateCall.where).toEqual({ id: 'winner-proposal' });
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

    const firstSavepointOrder =
      prisma.$executeRawUnsafe.mock.invocationCallOrder[0];
    const firstEvidenceCreateOrder =
      prisma.evidence.create.mock.invocationCallOrder[0];
    const firstProposalCreateOrder =
      prisma.extractedProposal.create.mock.invocationCallOrder[0];
    const rollbackOrder = prisma.$executeRawUnsafe.mock.invocationCallOrder[1];
    const releaseAfterRollbackOrder =
      prisma.$executeRawUnsafe.mock.invocationCallOrder[2];
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

    expect(prisma.extractedProposal.update).not.toHaveBeenCalled();
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

    expect(prisma.extractedProposal.update).not.toHaveBeenCalled();
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
    const proposalUpdateCall = lastCall(prisma.extractedProposal.update);
    expect(proposalUpdateCall.where).toEqual({ id: 'pending-proposal' });
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

  it('routes to manual review with extraction-incomplete, not no-tests-found, when the retry still finds nothing', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extract = jest.fn().mockResolvedValue({ kind: 'no-tests-found' });
    const extractor = fakeExtractor(extract);

    await build(prisma, twoDeclarationsSource(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(extract).toHaveBeenCalledTimes(2);
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      objective: 'extraction-incomplete',
      needsManualReview: true,
    });
  });

  it('never retries and keeps no-tests-found when the file has no test declarations at all', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extract = jest.fn().mockResolvedValue({ kind: 'no-tests-found' });
    const extractor = fakeExtractor(extract);

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(extract).toHaveBeenCalledTimes(1);
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({ objective: 'no-tests-found' });
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

  it('falls back to manual review with a fresh evidence row when the source is unavailable', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const sourceReader = fakeSourceReader(
      jest.fn().mockResolvedValue({ kind: 'unavailable', reason: 'http-404' }),
    );
    const extractor = fakeExtractor(jest.fn());

    await build(prisma, sourceReader, extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.evidence.create).toHaveBeenCalled();
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      targetTestCaseId: 'case-1',
      needsManualReview: true,
    });
  });

  it('falls back to manual review when the model reports no tests found', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      targetTestCaseId: 'case-1',
      needsManualReview: true,
      objective: 'no-tests-found',
    });
  });

  it('falls back to manual review when extraction yields no case matching the automationKey', async () => {
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

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      targetTestCaseId: 'case-1',
      needsManualReview: true,
      objective: 'automation-key-not-found',
    });
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

  it('creates an automation-key-not-found fallback proposal only for the unmatched target, while the matched one is documented directly', async () => {
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

    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
    const fallback = lastCall(prisma.extractedProposal.create).data;
    expect(fallback).toMatchObject({
      needsManualReview: true,
      objective: 'automation-key-not-found',
      targetTestCaseId: 'case-2',
    });
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

  it('fans a no-tests-found response out to every target in the chunk', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    const calls = prisma.extractedProposal.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    const objectives = calls.map(([call]) => call.data);
    expect(objectives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetTestCaseId: 'case-1',
          objective: 'no-tests-found',
        }),
        expect.objectContaining({
          targetTestCaseId: 'case-2',
          objective: 'no-tests-found',
        }),
      ]),
    );
  });

  it('fans an extraction-incomplete response out to every target when the file has declarations the model could not extract', async () => {
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

    const calls = prisma.extractedProposal.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    const objectives = calls.map(([call]) => call.data);
    expect(objectives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetTestCaseId: 'case-1',
          objective: 'extraction-incomplete',
        }),
        expect.objectContaining({
          targetTestCaseId: 'case-2',
          objective: 'extraction-incomplete',
        }),
      ]),
    );
  });

  it('falls back every target when the project has no repository connection', async () => {
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
    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(2);
  });

  it('falls back every target without calling the provider when the organization is not entitled', async () => {
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
    const calls = prisma.extractedProposal.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    expect(calls.map(([call]) => call.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objective: 'ai-not-enabled' }),
      ]),
    );
    expect(calls).toHaveLength(2);
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
    ).find(([sql]) => sql.includes('FOR UPDATE'));
    expect(lockCall).toBeDefined();
    expect(lockCall?.[0]).toContain('test_case');
    expect(lockCall?.slice(1)).toEqual(['case-1', 'case-2']);
    expect(prisma.$executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.testCaseVersion.create.mock.invocationCallOrder[0],
    );
  });

  it('routes every target to quota-exhausted without calling the provider when the daily budget is spent', async () => {
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

    const objectives = (
      prisma.extractedProposal.create.mock.calls as [
        { data: Record<string, unknown> },
      ][]
    ).map(([call]) => call.data);
    expect(objectives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetTestCaseId: 'case-1',
          objective: 'quota-exhausted',
        }),
        expect.objectContaining({
          targetTestCaseId: 'case-2',
          objective: 'quota-exhausted',
        }),
      ]),
    );
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
        documentationQueuedAt: { not: null },
      },
      data: {
        documentationOutcome: 'failed',
        documentationSkipReason: 'no-connection',
        documentationOutcomeAt: expect.any(Date) as Date,
        documentationQueuedAt: null,
      },
    });
  });

  it('never lets fallbackForTargets clobber a human edit or an outcome a fresher job already wrote', async () => {
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
    expect(call[0].where.documentationQueuedAt).toEqual({ not: null });
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

    const fallback = lastCall(prisma.extractedProposal.create).data;
    expect(fallback).toMatchObject({
      targetTestCaseId: 'case-2',
      objective: 'automation-key-not-found',
    });
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
    const fallback = lastCall(prisma.extractedProposal.create).data;
    expect(fallback).toMatchObject({
      targetTestCaseId: 'case-2',
      objective: 'automation-key-not-found',
    });
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
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'extraction-failed',
    });
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

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'provider-overloaded',
    });
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

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'invalid-credentials',
    });
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

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({ needsManualReview: true });
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

  it('stamps the locale on a manual-review fallback proposal too', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);

    await build(
      prisma,
      fakeSourceReader(
        jest
          .fn()
          .mockResolvedValue({ kind: 'unavailable', reason: 'http-404' }),
      ),
      fakeExtractor(jest.fn()),
    ).process(documentFileJob('en'));

    expect(lastCall(prisma.extractedProposal.create).data).toMatchObject({
      needsManualReview: true,
      locale: 'en',
    });
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

  it('does not spend a credit or write anything when the suite is deleted before the row lock', async () => {
    const prisma = createPrisma();
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

    expect(spendCredit).not.toHaveBeenCalled();
    expect(prisma.suite.update).not.toHaveBeenCalled();
    expect(prisma.suite.updateMany).not.toHaveBeenCalled();
  });

  it('does not spend a credit or write anything when a fresher execution already cleared documentationQueuedAt', async () => {
    const prisma = createPrisma();
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

    expect(spendCredit).not.toHaveBeenCalled();
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
