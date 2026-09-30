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

const connection = {
  provider: 'GITHUB' as const,
  repo: 'qably/qably',
  encryptedAccessToken: null as string | null,
};

const targets = [
  { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
  { testCaseId: 'case-2', automationKey: 'Cart > removes an item' },
];

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

function createPrisma(plan: string) {
  const prisma = {
    organization: {
      findUnique: jest.fn().mockResolvedValue({
        plan,
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
        projectId: 'project-1',
        project: { organizationId: 'org-1', connection },
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'case-updated' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    testCaseVersion: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'version-new', version: 1 }),
    },
    suite: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    evidence: { create: jest.fn(), update: jest.fn() },
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
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
  const read = jest.fn().mockResolvedValue({
    kind: 'content',
    content,
    truncated,
  });
  return { reader: { read } as unknown as SourceReader, read };
}

function build(
  prisma: FakePrisma,
  sourceReader: SourceReader,
  extractor: TestCaseExtractor,
) {
  const entitlement = new AiEntitlementService(prisma as never);
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
    new ExtractionFailureRecorder(prisma as never),
    new ExtractedProposalWriter(prisma as never, entitlement, {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as never),
  );

  jest.spyOn(processor['logger'], 'warn').mockImplementation(() => undefined);
  jest.spyOn(processor['logger'], 'error').mockImplementation(() => undefined);

  return processor;
}

function extractorReturning(extract: jest.Mock): TestCaseExtractor {
  return { extract, summarizeSuite: jest.fn() };
}

function documentFileJob() {
  return {
    data: { kind: 'document-file', filePath: FILE_PATH, targets },
  } as never;
}

function documentCaseJob(prisma: FakePrisma) {
  prisma.testCase.findUnique.mockResolvedValue({
    id: 'case-1',
    projectId: 'project-1',
    suiteId: 'suite-1',
    name: 'Adds an item',
    automationKey: 'Cart > adds an item',
    automationFilePath: FILE_PATH,
    automationClassName: null,
    suite: { name: 'Cart' },
    project: { organizationId: 'org-1', connection },
  });

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

function ingestedRows(...ids: string[]) {
  return ids.map((id) => ({
    id,
    suiteId: 'suite-1',
    documentationSource: 'ingestion',
  }));
}

describe('ExtractionProcessor — the source size follows the plan', () => {
  const noTests = () =>
    extractorReturning(jest.fn().mockResolvedValue({ kind: 'no-tests-found' }));

  it.each([
    ['gratuito', 60_000],
    ['equipo', 60_000],
    ['empresa', 1_000_000],
  ])(
    'reads a document-file source with the %s limit of %i characters',
    async (plan, limit) => {
      const prisma = createPrisma(plan);
      const { reader, read } = sourceReaderReturning('file body', false);

      await build(prisma, reader, noTests()).process(documentFileJob());

      expect(read).toHaveBeenCalledWith(
        expect.objectContaining({ maxContentLength: limit }),
      );
    },
  );

  it.each([
    ['gratuito', 60_000],
    ['empresa', 1_000_000],
  ])(
    'reads a document-case source with the %s limit of %i characters',
    async (plan, limit) => {
      const prisma = createPrisma(plan);
      const job = documentCaseJob(prisma);
      const { reader, read } = sourceReaderReturning('file body', false);

      await build(prisma, reader, noTests()).process(job);

      expect(read).toHaveBeenCalledWith(
        expect.objectContaining({ maxContentLength: limit }),
      );
    },
  );

  it.each([
    ['gratuito', 60_000],
    ['empresa', 1_000_000],
  ])(
    'reads a code-change source with the %s limit of %i characters',
    async (plan, limit) => {
      const prisma = createPrisma(plan);
      const { reader, read } = sourceReaderReturning('file body', false);

      await build(prisma, reader, noTests()).process(codeChangeJob());

      expect(read).toHaveBeenCalledWith(
        expect.objectContaining({ maxContentLength: limit }),
      );
    },
  );

  it('does not read the source at all when the organization is not entitled', async () => {
    const prisma = createPrisma('empresa');
    prisma.organization.findUnique.mockResolvedValue({
      plan: 'empresa',
      aiEnabled: false,
      aiCreditsUsed: 0,
      aiCreditsPeriodStart: new Date(),
    });
    const { reader, read } = sourceReaderReturning('file body', false);

    await build(prisma, reader, noTests()).process(documentFileJob());

    expect(read).not.toHaveBeenCalled();
  });
});

describe('ExtractionProcessor — document-file reason for a cut source', () => {
  const elsewhere = extractedCase({ automationKey: 'Somewhere else > other' });

  it('records source-truncated for every target when a cut source matched none, after the retry round', async () => {
    const prisma = createPrisma('gratuito');
    const extract = jest.fn().mockResolvedValue(extractedOutcome([elsewhere]));
    const { reader } = sourceReaderReturning('a'.repeat(60_000), true);

    await build(prisma, reader, extractorReturning(extract)).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledTimes(2);
    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].where.id.in).toEqual(['case-1', 'case-2']);
    expect(writes[0].data.documentationSkipReason).toBe('source-truncated');
  });

  it('records source-truncated only for the targets still unmatched when a cut source matched some', async () => {
    const prisma = createPrisma('gratuito');
    prisma.testCase.findMany.mockResolvedValue(ingestedRows('case-1'));
    const extract = jest
      .fn()
      .mockResolvedValue(extractedOutcome([extractedCase()]));
    const { reader } = sourceReaderReturning('a'.repeat(60_000), true);

    await build(prisma, reader, extractorReturning(extract)).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledTimes(2);
    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].where.id.in).toEqual(['case-2']);
    expect(writes[0].data.documentationSkipReason).toBe('source-truncated');
  });

  it('keeps automation-key-not-found for every target when the whole file was read and none matched', async () => {
    const prisma = createPrisma('gratuito');
    const extract = jest.fn().mockResolvedValue(extractedOutcome([elsewhere]));
    const { reader } = sourceReaderReturning('file body', false);

    await build(prisma, reader, extractorReturning(extract)).process(
      documentFileJob(),
    );

    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].where.id.in).toEqual(['case-1', 'case-2']);
    expect(writes[0].data.documentationSkipReason).toBe(
      'automation-key-not-found',
    );
  });

  it('keeps automation-key-not-found for the unmatched target when the whole file was read and some matched', async () => {
    const prisma = createPrisma('gratuito');
    prisma.testCase.findMany.mockResolvedValue(ingestedRows('case-1'));
    const extract = jest
      .fn()
      .mockResolvedValue(extractedOutcome([extractedCase()]));
    const { reader } = sourceReaderReturning('file body', false);

    await build(prisma, reader, extractorReturning(extract)).process(
      documentFileJob(),
    );

    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].where.id.in).toEqual(['case-2']);
    expect(writes[0].data.documentationSkipReason).toBe(
      'automation-key-not-found',
    );
  });

  it('records no failure when a cut source still matched every target', async () => {
    const prisma = createPrisma('gratuito');
    prisma.testCase.findMany.mockResolvedValue(
      ingestedRows('case-1', 'case-2'),
    );
    const extract = jest.fn().mockResolvedValue(
      extractedOutcome([
        extractedCase(),
        extractedCase({
          automationKey: 'Cart > removes an item',
          title: 'Removes an item from the cart',
        }),
      ]),
    );
    const { reader } = sourceReaderReturning('a'.repeat(60_000), true);

    await build(prisma, reader, extractorReturning(extract)).process(
      documentFileJob(),
    );

    expect(extract).toHaveBeenCalledTimes(1);
    expect(failureWrites(prisma)).toEqual([]);
  });

  it('keeps the no-tests-found reason when the model found nothing in a cut source', async () => {
    const prisma = createPrisma('gratuito');
    const { reader } = sourceReaderReturning('a'.repeat(60_000), true);

    await build(
      prisma,
      reader,
      extractorReturning(
        jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
      ),
    ).process(documentFileJob());

    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].data.documentationSkipReason).toBe('no-tests-found');
  });
});
