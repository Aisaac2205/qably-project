import type { AiDailyBudget } from '../ai/ai-daily-budget.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { TestCaseExtractor } from '../ai/extraction.contracts';
import type { SourceReader } from '../repository/source-reader';
import type { TestFileLocator } from '../repository/test-file-locator';
import { ExtractionFailureRecorder } from './extraction-failure-recorder';
import { ExtractedProposalWriter } from './extracted-proposal-writer';
import { ExtractionProcessor } from './extraction.processor';

const FILE_PATH = 'src/cart.spec.ts';
const CUT_SOURCE = 'a'.repeat(60_000);
const WHOLE_SOURCE = 'file body';

const connection = {
  provider: 'GITHUB' as const,
  repo: 'qably/qably',
  encryptedAccessToken: null as string | null,
};

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

function extractedOutcome(cases: ReturnType<typeof extractedCase>[]) {
  return {
    kind: 'extracted' as const,
    cases,
    suite: null,
    usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
  };
}

function createPrisma() {
  const prisma = {
    organization: {
      findUnique: jest.fn().mockResolvedValue({
        plan: 'gratuito',
        aiEnabled: true,
        aiCreditsUsed: 0,
        aiCreditsPeriodStart: new Date(),
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    codeChange: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'change-1',
        projectId: 'project-1',
        filePath: FILE_PATH,
        commitSha: 'sha-1',
        evidenceId: 'evidence-1',
        project: { organizationId: 'org-1', connection },
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    testCase: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'case-1',
        projectId: 'project-1',
        suiteId: 'suite-1',
        name: 'Adds an item',
        automationKey: 'Cart > adds an item',
        automationFilePath: FILE_PATH,
        automationClassName: null,
        suite: { name: 'Cart' },
        project: { organizationId: 'org-1', connection },
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'case-updated' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    suite: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    evidence: {
      create: jest.fn().mockResolvedValue({ id: 'evidence-new' }),
      update: jest.fn(),
    },
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'proposal-new' }),
      update: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };

  prisma.$transaction.mockImplementation((run: (tx: unknown) => unknown) =>
    run(prisma),
  );

  return prisma;
}

type FakePrisma = ReturnType<typeof createPrisma>;

function sourceReaderReturning(content: string, truncated: boolean) {
  return {
    read: jest.fn().mockResolvedValue({ kind: 'content', content, truncated }),
  } as unknown as SourceReader;
}

function build(
  prisma: FakePrisma,
  sourceReader: SourceReader,
  extract: jest.Mock,
) {
  const entitlement = new AiEntitlementService(prisma as never);
  const recorder = new ExtractionFailureRecorder(prisma as never);
  const extractor: TestCaseExtractor = { extract, summarizeSuite: jest.fn() };

  const processor = new ExtractionProcessor(
    prisma as never,
    sourceReader,
    extractor,
    { decrypt: jest.fn() } as unknown as EncryptionService,
    entitlement,
    {
      tryConsume: jest.fn().mockResolvedValue(true),
    } as unknown as AiDailyBudget,
    { locate: jest.fn() } as unknown as TestFileLocator,
    recorder,
    new ExtractedProposalWriter(prisma as never, entitlement, {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as never),
  );

  jest.spyOn(processor['logger'], 'warn').mockImplementation(() => undefined);
  const recorderWarn = jest
    .spyOn(recorder['logger'], 'warn')
    .mockImplementation(() => undefined);

  return { processor, recorderWarn };
}

function documentCaseJob() {
  return { data: { kind: 'document-case', testCaseId: 'case-1' } } as never;
}

function codeChangeJob() {
  return {
    data: { kind: 'code-change', codeChangeId: 'change-1' },
  } as never;
}

interface FailureWrite {
  where: { id: { in: string[] } };
  data: Record<string, unknown>;
}

function failureWrites(prisma: FakePrisma): FailureWrite[] {
  return (prisma.testCase.updateMany.mock.calls as [FailureWrite][])
    .map(([write]) => write)
    .filter((write) => write.data.documentationOutcome === 'failed');
}

const elsewhere = extractedCase({ automationKey: 'Somewhere else > other' });

describe('ExtractionProcessor — document-case reason for a cut source', () => {
  it('records source-truncated when the source was cut and the model returned no case for the target', async () => {
    const prisma = createPrisma();
    const extract = jest.fn().mockResolvedValue(extractedOutcome([elsewhere]));

    await build(
      prisma,
      sourceReaderReturning(CUT_SOURCE, true),
      extract,
    ).processor.process(documentCaseJob());

    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].where.id.in).toEqual(['case-1']);
    expect(writes[0].data.documentationSkipReason).toBe('source-truncated');
  });

  it('keeps automation-key-not-found when the whole file was read and no case matched the target', async () => {
    const prisma = createPrisma();
    const extract = jest.fn().mockResolvedValue(extractedOutcome([elsewhere]));

    await build(
      prisma,
      sourceReaderReturning(WHOLE_SOURCE, false),
      extract,
    ).processor.process(documentCaseJob());

    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].data.documentationSkipReason).toBe(
      'automation-key-not-found',
    );
  });

  it('spends the credit before recording source-truncated, like any other outcome of a real call', async () => {
    const prisma = createPrisma();
    const extract = jest.fn().mockResolvedValue(extractedOutcome([elsewhere]));

    await build(
      prisma,
      sourceReaderReturning(CUT_SOURCE, true),
      extract,
    ).processor.process(documentCaseJob());

    expect(prisma.organization.updateMany).toHaveBeenCalledTimes(1);
  });

  it('records ai-not-enabled instead of source-truncated when the credit cannot be spent', async () => {
    const prisma = createPrisma();
    prisma.organization.updateMany.mockResolvedValue({ count: 0 });
    const extract = jest.fn().mockResolvedValue(extractedOutcome([elsewhere]));

    await build(
      prisma,
      sourceReaderReturning(CUT_SOURCE, true),
      extract,
    ).processor.process(documentCaseJob());

    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].data.documentationSkipReason).toBe('ai-not-enabled');
  });

  it('writes the proposal and records no failure when a cut source still contained the target', async () => {
    const prisma = createPrisma();
    const extract = jest
      .fn()
      .mockResolvedValue(extractedOutcome([extractedCase()]));

    await build(
      prisma,
      sourceReaderReturning(CUT_SOURCE, true),
      extract,
    ).processor.process(documentCaseJob());

    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
    expect(failureWrites(prisma)).toEqual([]);
  });

  it('keeps the no-tests-found reason when the model found nothing in a cut source', async () => {
    const prisma = createPrisma();
    const extract = jest.fn().mockResolvedValue({ kind: 'no-tests-found' });

    await build(
      prisma,
      sourceReaderReturning(CUT_SOURCE, true),
      extract,
    ).processor.process(documentCaseJob());

    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].data.documentationSkipReason).toBe('no-tests-found');
  });
});

describe('ExtractionProcessor — code-change reason for a cut source', () => {
  it('reports source-truncated in the failure log when a cut source produced an empty extraction', async () => {
    const prisma = createPrisma();
    const extract = jest.fn().mockResolvedValue(extractedOutcome([]));

    const { processor, recorderWarn } = build(
      prisma,
      sourceReaderReturning(CUT_SOURCE, true),
      extract,
    );
    await processor.process(codeChangeJob());

    expect(recorderWarn).toHaveBeenCalledWith(
      `Extraction failed for ${FILE_PATH} with no target case, reason: source-truncated`,
    );
  });

  it('keeps automation-key-not-found in the failure log when the whole file was read', async () => {
    const prisma = createPrisma();
    const extract = jest.fn().mockResolvedValue(extractedOutcome([]));

    const { processor, recorderWarn } = build(
      prisma,
      sourceReaderReturning(WHOLE_SOURCE, false),
      extract,
    );
    await processor.process(codeChangeJob());

    expect(recorderWarn).toHaveBeenCalledWith(
      `Extraction failed for ${FILE_PATH} with no target case, reason: automation-key-not-found`,
    );
  });

  it('writes proposals and reports no failure when a cut source still yielded cases', async () => {
    const prisma = createPrisma();
    const extract = jest
      .fn()
      .mockResolvedValue(extractedOutcome([extractedCase()]));

    const { processor, recorderWarn } = build(
      prisma,
      sourceReaderReturning(CUT_SOURCE, true),
      extract,
    );
    await processor.process(codeChangeJob());

    expect(recorderWarn).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
  });
});
