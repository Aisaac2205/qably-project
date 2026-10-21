import type { Env } from '../../config/env';
import type { AiDailyBudget } from '../ai/ai-daily-budget.service';
import type { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { TestCaseExtractor } from '../ai/extraction.contracts';
import type { SourceReader } from '../repository/source-reader';
import type { TestFileLocator } from '../repository/test-file-locator';
import { ExtractionFailureRecorder } from './extraction-failure-recorder';
import { ExtractedProposalWriter } from './extracted-proposal-writer';
import { ExtractionProcessor } from './extraction.processor';

/**
 * How a document-file job behaves next to the other writers of a test case:
 * an approval, a person editing the case, another job. Each test drives the
 * job through `process` against a transaction client distinct from the pool
 * client, so a read that escapes the transaction is visible.
 */

const FILE_PATH = 'src/cart.spec.ts';
const LOCK_SQL = /FROM "test_case" WHERE id IN \(.*\) ORDER BY id FOR UPDATE/;

const connection = {
  provider: 'GITHUB' as const,
  repo: 'qably/qably',
  encryptedAccessToken: null as string | null,
};

const targets = [
  { testCaseId: 'case-1', automationKey: 'Cart > adds an item' },
  { testCaseId: 'case-2', automationKey: 'Cart > removes an item' },
];

function extractedCase(automationKey: string, title: string) {
  return {
    automationKey,
    title,
    objective: `Verify that ${title.toLowerCase()}`,
    preconditions: [],
    steps: ['Open the cart', 'Check the total'],
    expectedResult: 'The total is right',
    priority: 'medium' as const,
    sourceExcerpt: `it('${title}', () => {})`,
  };
}

const extracted = [
  extractedCase('Cart > adds an item', 'Adds an item'),
  extractedCase('Cart > removes an item', 'Removes an item'),
];

function caseRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    suiteId: 'suite-1',
    name: `Old ${id}`,
    documentationSource: 'ingestion',
    currentVersion: null,
    ...overrides,
  };
}

function createTx(rows: ReturnType<typeof caseRow>[]) {
  return {
    testCase: {
      findMany: jest.fn().mockResolvedValue(rows),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    testCaseVersion: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(
          (args: { data: { testCaseId: string; version: number } }) =>
            Promise.resolve({
              id: `${args.data.testCaseId}-v${args.data.version}`,
              version: args.data.version,
            }),
        ),
    },
    extractedProposal: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    suite: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };
}

type FakeTx = ReturnType<typeof createTx>;

function createPrisma(tx: FakeTx) {
  return {
    codeChange: { findFirst: jest.fn().mockResolvedValue(null) },
    testCase: {
      findUnique: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        project: { organizationId: 'org-1', connection },
      }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn((run: (client: FakeTx) => unknown) => run(tx)),
  };
}

type FakePrisma = ReturnType<typeof createPrisma>;

function fakeEntitlement(spendCredit = jest.fn().mockResolvedValue(true)) {
  return {
    isEntitled: jest.fn().mockResolvedValue(true),
    spendCredit,
    maxSourceCharacters: jest.fn().mockResolvedValue(60_000),
  };
}

function build(
  prisma: FakePrisma,
  entitlement = fakeEntitlement(),
  reclassifier = { enqueue: jest.fn().mockResolvedValue(undefined) },
) {
  const sourceReader = {
    read: jest.fn().mockResolvedValue({
      kind: 'content',
      content: 'file body',
      truncated: false,
    }),
  } as unknown as SourceReader;
  const extractor = {
    extract: jest.fn().mockResolvedValue({
      kind: 'extracted',
      cases: extracted,
      suite: null,
      usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
    }),
    summarizeSuite: jest.fn(),
  } as unknown as TestCaseExtractor;

  const processor = new ExtractionProcessor(
    prisma as never,
    sourceReader,
    extractor,
    { decrypt: jest.fn() } as unknown as EncryptionService,
    entitlement as unknown as AiEntitlementService,
    {
      tryConsume: jest.fn().mockResolvedValue(true),
    } as unknown as AiDailyBudget,
    { locate: jest.fn() } as unknown as TestFileLocator,
    new ExtractionFailureRecorder(prisma as never),
    new ExtractedProposalWriter(
      prisma as never,
      entitlement as unknown as AiEntitlementService,
      { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
      { publish: jest.fn() } as never,
    ),
    { GEMINI_MODEL: 'gemini-test' } as Env,
  );

  jest.spyOn(processor['logger'], 'log').mockImplementation(() => undefined);
  jest.spyOn(processor['logger'], 'warn').mockImplementation(() => undefined);
  jest.spyOn(processor['logger'], 'error').mockImplementation(() => undefined);

  return { processor, entitlement, reclassifier };
}

function documentFileJob(attempt = { attemptsStarted: 1, attempts: 3 }) {
  return {
    data: { kind: 'document-file', filePath: FILE_PATH, targets },
    attemptsStarted: attempt.attemptsStarted,
    opts: { attempts: attempt.attempts },
  } as never;
}

function lockCallOrder(tx: FakeTx): number {
  const index = (tx.$executeRawUnsafe.mock.calls as [string][]).findIndex(
    ([sql]) => LOCK_SQL.test(sql),
  );
  expect(index).toBeGreaterThanOrEqual(0);
  return tx.$executeRawUnsafe.mock.invocationCallOrder[index];
}

function caseWrite(
  tx: FakeTx,
  caseId: string,
): Record<string, unknown> | undefined {
  const calls = tx.testCase.update.mock.calls as [
    { where: { id: string }; data: Record<string, unknown> },
  ][];
  return calls.find(([call]) => call.where.id === caseId)?.[0].data;
}

function publishedCaseIds(tx: FakeTx): string[] {
  return (
    tx.testCaseVersion.create.mock.calls as [{ data: { testCaseId: string } }][]
  ).map(([call]) => call.data.testCaseId);
}

describe('ExtractionProcessor — document-file lock order', () => {
  it('spends the credit, which locks the organization row, before it locks the target cases', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    const prisma = createPrisma(tx);
    const { processor, entitlement } = build(prisma);

    await processor.process(documentFileJob());

    expect(entitlement.spendCredit).toHaveBeenCalledWith('org-1', tx);
    const [spendOrder] = entitlement.spendCredit.mock.invocationCallOrder;
    expect(spendOrder).toBeLessThan(lockCallOrder(tx));
  });

  it('reads the cases and their current versions inside the transaction, after the lock', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await processor.process(documentFileJob());

    expect(prisma.testCase.findMany).not.toHaveBeenCalled();
    expect(tx.testCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['case-1', 'case-2'] } },
      }),
    );
    const [readOrder] = tx.testCase.findMany.mock.invocationCallOrder;
    expect(readOrder).toBeGreaterThan(lockCallOrder(tx));
  });

  it('leaves alone a case a person documented while the job waited for the lock', async () => {
    const tx = createTx([
      caseRow('case-1', { documentationSource: 'human' }),
      caseRow('case-2'),
    ]);
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await processor.process(documentFileJob());

    expect(publishedCaseIds(tx)).toEqual(['case-2']);
    expect(caseWrite(tx, 'case-1')).toMatchObject({
      documentationOutcome: 'skipped',
      documentationSkipReason: 'human-documented',
    });
  });

  it('does not lock or read the cases when the organization has no credit left', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    const prisma = createPrisma(tx);
    const { processor } = build(
      prisma,
      fakeEntitlement(jest.fn().mockResolvedValue(false)),
    );

    await processor.process(documentFileJob());

    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(tx.testCase.findMany).not.toHaveBeenCalled();
    expect(tx.testCaseVersion.create).not.toHaveBeenCalled();
  });
});
