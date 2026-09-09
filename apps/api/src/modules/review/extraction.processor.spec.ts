import { DEFAULT_LOCALE } from '@qably/i18n';
import type { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { SourceReader } from '../repository/source-reader';
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
  };
  suite: { findFirst: jest.Mock };
  evidence: { create: jest.Mock; update: jest.Mock };
  extractedProposal: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
  $executeRawUnsafe: jest.Mock;
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
    },
    suite: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({ id: 'suite-by-name' })
        .mockResolvedValue({ id: 'suite-by-name' }),
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

function fakeExtractor(extract: jest.Mock): TestCaseExtractor {
  return { extract };
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

function build(
  prisma: FakePrisma,
  sourceReader: SourceReader,
  extractor: TestCaseExtractor,
  encryption: EncryptionService = fakeEncryption(),
  entitlement: AiEntitlementService = fakeEntitlement(),
) {
  return new ExtractionProcessor(
    prisma as never,
    sourceReader,
    extractor,
    encryption,
    entitlement,
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

function extractedOutcome(cases: ReturnType<typeof extractedCase>[]) {
  return {
    kind: 'extracted' as const,
    cases,
    usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
  };
}

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

  it('persists one proposal per matched target with its own targetTestCaseId', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1' },
      { id: 'case-2', suiteId: 'suite-2' },
    ]);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
          extractedCase({ automationKey: 'Cart > removes an item' }),
        ]),
      ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(2);
    const calls = prisma.extractedProposal.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    expect(calls.map(([call]) => call.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetTestCaseId: 'case-1',
          suiteId: 'suite-1',
          codeChangeId: null,
        }),
        expect.objectContaining({
          targetTestCaseId: 'case-2',
          suiteId: 'suite-2',
          codeChangeId: null,
        }),
      ]),
    );
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
      jest.fn().mockResolvedValue(
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

  it('creates an automation-key-not-found fallback for each target absent from the response', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1' },
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

    const calls = prisma.extractedProposal.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    const fallback = calls
      .map(([call]) => call.data)
      .find((data) => data.targetTestCaseId === 'case-2');

    expect(fallback).toMatchObject({
      needsManualReview: true,
      objective: 'automation-key-not-found',
      targetTestCaseId: 'case-2',
    });
    const matched = calls
      .map(([call]) => call.data)
      .find((data) => data.targetTestCaseId === 'case-1');
    expect(matched?.needsManualReview).toBeUndefined();
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

  it('skips a target that already has an in-review proposal on a redelivered chunk, without losing the rest', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(firstTargetRow);
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1' },
      { id: 'case-2', suiteId: 'suite-2' },
    ]);
    prisma.extractedProposal.findFirst.mockImplementation(
      (args: { where: Record<string, unknown> }) =>
        Promise.resolve(
          args.where.targetTestCaseId === 'case-1' ? { id: 'already-pending' } : null,
        ),
    );
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue(
        extractedOutcome([
          extractedCase({ automationKey: 'Cart > adds an item' }),
          extractedCase({ automationKey: 'Cart > removes an item' }),
        ]),
      ),
    );

    await build(prisma, fakeSourceReader(), extractor).process(
      documentFileJob(),
    );

    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({ targetTestCaseId: 'case-2' });
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
