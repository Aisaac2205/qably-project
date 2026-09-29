import type { AiDailyBudget } from '../ai/ai-daily-budget.service';
import type { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { TestCaseExtractor } from '../ai/extraction.contracts';
import type { SourceReader } from '../repository/source-reader';
import type { TestFileLocator } from '../repository/test-file-locator';
import { ExtractionFailureRecorder } from './extraction-failure-recorder';
import { ExtractedProposalWriter } from './extracted-proposal-writer';
import { ExtractionProcessor } from './extraction.processor';

const FILE_PATH = 'src/cart.spec.ts';
const SOURCE_BODY = 'file body';
const CUT_LENGTH = 60_000;

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

function createPrisma() {
  const prisma = {
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
  return { read } as unknown as SourceReader;
}

function extractorReturning(extract: jest.Mock): TestCaseExtractor {
  return { extract, summarizeSuite: jest.fn() };
}

function build(
  prisma: FakePrisma,
  sourceReader: SourceReader,
  extractor: TestCaseExtractor,
) {
  const entitlement = {
    isEntitled: jest.fn().mockResolvedValue(true),
    spendCredit: jest.fn().mockResolvedValue(true),
  } as unknown as AiEntitlementService;
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

  const warn = jest
    .spyOn(processor['logger'], 'warn')
    .mockImplementation(() => undefined);
  const error = jest
    .spyOn(processor['logger'], 'error')
    .mockImplementation(() => undefined);

  return { processor, warn, error };
}

function documentFileJob() {
  return {
    data: { kind: 'document-file', filePath: FILE_PATH, targets },
  } as never;
}

interface FailureWrite {
  where: { id: { in: string[] } };
  data: Record<string, unknown>;
}

function lastFailureWrite(prisma: FakePrisma): FailureWrite {
  const calls = prisma.testCase.updateMany.mock.calls as [FailureWrite][];
  return calls[calls.length - 1][0];
}

function warnings(warn: jest.SpyInstance): string[] {
  return (warn.mock.calls as [string][]).map(([message]) => message);
}

describe('ExtractionProcessor — document-file unmatched targets diagnostics', () => {
  it('warns once with the matched of total counts, the unmatched keys, the source length and the truncation flag', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const { processor, warn } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(
        jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
      ),
    );

    await processor.process(documentFileJob());

    const unmatched = warnings(warn).filter((message) =>
      message.includes('unmatched'),
    );
    expect(unmatched).toEqual([
      `Matched 1 of 2 target(s) in ${FILE_PATH}; 1 unmatched: "Cart > removes an item"; source length ${SOURCE_BODY.length} characters, not truncated`,
    ]);
  });

  it('still records the unmatched target as failed with the same reason', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const { processor } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(
        jest.fn().mockResolvedValue(extractedOutcome([extractedCase()])),
      ),
    );

    await processor.process(documentFileJob());

    const failure = lastFailureWrite(prisma);
    expect(failure.where.id.in).toEqual(['case-2']);
    expect(failure.data).toMatchObject({
      documentationOutcome: 'failed',
      documentationSkipReason: 'automation-key-not-found',
    });
  });

  it('warns before giving up when the model answered but matched no target', async () => {
    const prisma = createPrisma();
    const { processor, warn } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, true),
      extractorReturning(
        jest
          .fn()
          .mockResolvedValue(
            extractedOutcome([
              extractedCase({ automationKey: 'Somewhere else > other' }),
            ]),
          ),
      ),
    );

    await processor.process(documentFileJob());

    expect(warnings(warn)).toContain(
      `Matched 0 of 2 target(s) in ${FILE_PATH}; 2 unmatched: "Cart > adds an item", "Cart > removes an item"; source length ${SOURCE_BODY.length} characters, truncated`,
    );
  });

  it('does not warn about unmatched targets when every target is matched', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const { processor, warn } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(
        jest.fn().mockResolvedValue(
          extractedOutcome([
            extractedCase(),
            extractedCase({
              automationKey: 'Cart > removes an item',
              title: 'Removes an item from the cart',
            }),
          ]),
        ),
      ),
    );

    await processor.process(documentFileJob());

    expect(
      warnings(warn).filter((message) => message.includes('unmatched')),
    ).toEqual([]);
  });
});

describe('ExtractionProcessor — truncated source diagnostics', () => {
  const cutSource = 'a'.repeat(CUT_LENGTH);
  const cutWarning = `Source for ${FILE_PATH} was cut at ${CUT_LENGTH} characters: cases located after the cut cannot be documented`;

  it('warns that the document-file source was cut, with its length', async () => {
    const prisma = createPrisma();
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
      { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
    ]);
    const { processor, warn } = build(
      prisma,
      sourceReaderReturning(cutSource, true),
      extractorReturning(
        jest.fn().mockResolvedValue(
          extractedOutcome([
            extractedCase(),
            extractedCase({
              automationKey: 'Cart > removes an item',
              title: 'Removes an item from the cart',
            }),
          ]),
        ),
      ),
    );

    await processor.process(documentFileJob());

    expect(warnings(warn)).toContain(cutWarning);
  });

  it('does not warn about a cut when the whole file was read', async () => {
    const prisma = createPrisma();
    const { processor, warn } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(
        jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
      ),
    );

    await processor.process(documentFileJob());

    expect(
      warnings(warn).filter((message) => message.includes('was cut at')),
    ).toEqual([]);
  });

  it('warns that the source was cut for a document-case job', async () => {
    const prisma = createPrisma();
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
    const { processor, warn } = build(
      prisma,
      sourceReaderReturning(cutSource, true),
      extractorReturning(
        jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
      ),
    );

    await processor.process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(warnings(warn)).toContain(cutWarning);
  });

  it('warns that the source was cut for a code-change job', async () => {
    const prisma = createPrisma();
    const { processor, warn } = build(
      prisma,
      sourceReaderReturning(cutSource, true),
      extractorReturning(
        jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
      ),
    );

    await processor.process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(warnings(warn)).toContain(cutWarning);
  });
});

describe('ExtractionProcessor — name collision diagnostics', () => {
  function uniqueViolation(fields: string[]) {
    return Object.assign(
      new Error(
        `Unique constraint failed on the fields: (${fields.join(',')})`,
      ),
      { code: 'P2002', meta: { target: fields } },
    );
  }

  const nameCollision = uniqueViolation(['suiteId', 'name']);

  function collidingPrisma(error: unknown = nameCollision) {
    const prisma = createPrisma();
    const tx = {
      ...prisma,
      testCase: {
        ...prisma.testCase,
        findMany: jest.fn(),
        update: jest.fn().mockRejectedValue(error),
      },
    };
    prisma.$transaction.mockImplementation((run: (tx: unknown) => unknown) =>
      run(tx),
    );
    prisma.testCase.findMany
      .mockResolvedValueOnce([
        { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
        { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
      ])
      .mockResolvedValueOnce([
        { id: 'case-1', suiteId: 'suite-1' },
        { id: 'case-2', suiteId: 'suite-1' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'case-9',
          suiteId: 'suite-1',
          name: 'Adds an item to the cart',
          automationKey: 'Cart > someone else',
        },
      ]);

    return { prisma, tx };
  }

  function bothCasesShareOneTitle() {
    return jest
      .fn()
      .mockResolvedValue(
        extractedOutcome([
          extractedCase(),
          extractedCase({ automationKey: 'Cart > removes an item' }),
        ]),
      );
  }

  it('logs the repeated incoming titles and the case that holds a title when a name collision aborts the write', async () => {
    const { prisma } = collidingPrisma();
    const { processor, error } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(bothCasesShareOneTitle()),
    );

    await processor.process(documentFileJob());

    const messages = (error.mock.calls as [string][]).map(([m]) => m);
    expect(messages).toContain(
      `Persisting the documentation for ${FILE_PATH} hit the unique (suiteId, name) constraint. ` +
        'Incoming titles repeated within the job: "Adds an item to the cart" in suite suite-1 (keys "Cart > adds an item", "Cart > removes an item"). ' +
        'Incoming titles already held by another case: "Adds an item to the cart" in suite suite-1 is held by case case-9 (key "Cart > someone else").',
    );
  });

  it('runs the diagnosis queries on the connection pool, never inside the aborted transaction', async () => {
    const { prisma, tx } = collidingPrisma();
    const { processor } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(bothCasesShareOneTitle()),
    );

    await processor.process(documentFileJob());

    expect(tx.testCase.findMany).not.toHaveBeenCalled();
    expect(prisma.testCase.findMany).toHaveBeenCalledTimes(3);
  });

  it('leaves the existing failure handling untouched: the original error still reaches the catch-all', async () => {
    const { prisma } = collidingPrisma();
    const { processor, error } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(bothCasesShareOneTitle()),
    );

    await expect(processor.process(documentFileJob())).resolves.toBeUndefined();

    expect(
      (error.mock.calls as [string][]).some(([message]) =>
        message.includes(
          `Document-file extraction for ${FILE_PATH} failed unexpectedly: ${nameCollision.message}`,
        ),
      ),
    ).toBe(true);
    expect(lastFailureWrite(prisma).data).toMatchObject({
      documentationOutcome: 'failed',
      documentationSkipReason: 'extraction-failed',
    });
  });

  it('still rethrows the original error when the diagnosis lookup itself fails', async () => {
    const { prisma } = collidingPrisma();
    prisma.testCase.findMany.mockReset();
    prisma.testCase.findMany
      .mockResolvedValueOnce([
        { id: 'case-1', suiteId: 'suite-1', documentationSource: 'ingestion' },
        { id: 'case-2', suiteId: 'suite-1', documentationSource: 'ingestion' },
      ])
      .mockRejectedValue(new Error('connection lost'));
    const { processor, error } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(bothCasesShareOneTitle()),
    );

    await processor.process(documentFileJob());

    const messages = (error.mock.calls as [string][]).map(([m]) => m);
    expect(messages).toContain(
      `Persisting the documentation for ${FILE_PATH} hit the unique (suiteId, name) constraint, and the diagnosis lookup failed`,
    );
    expect(
      messages.some((message) => message.includes(nameCollision.message)),
    ).toBe(true);
  });

  it('does not run the diagnosis for a unique violation on another constraint', async () => {
    const { prisma } = collidingPrisma(
      uniqueViolation(['suiteId', 'automationKey']),
    );
    const { processor, error } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(bothCasesShareOneTitle()),
    );

    await processor.process(documentFileJob());

    expect(prisma.testCase.findMany).toHaveBeenCalledTimes(1);
    expect(
      (error.mock.calls as [string][]).some(([message]) =>
        message.includes('unique (suiteId, name) constraint'),
      ),
    ).toBe(false);
  });

  it('does not run the diagnosis for an error that is not a unique violation', async () => {
    const { prisma } = collidingPrisma(new Error('deadlock detected'));
    const { processor } = build(
      prisma,
      sourceReaderReturning(SOURCE_BODY, false),
      extractorReturning(bothCasesShareOneTitle()),
    );

    await processor.process(documentFileJob());

    expect(prisma.testCase.findMany).toHaveBeenCalledTimes(1);
  });
});
