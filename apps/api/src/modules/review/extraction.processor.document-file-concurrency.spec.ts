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
import { RetryableTransactionConflictError } from './lib/transient-transaction-conflict';

/**
 * How a document-file job behaves next to the other writers of a test case:
 * an approval, a person editing the case, another job. Each test drives the
 * job through `process` against a transaction client distinct from the pool
 * client, so a read that escapes the transaction is visible.
 */

const FILE_PATH = 'src/cart.spec.ts';
// FOR NO KEY UPDATE, not FOR UPDATE: it still serializes the writers of a
// case, but lets a proposal that references the case take its foreign-key
// share lock, so a reclassify or a push never waits on it in a cycle.
const LOCK_SQL =
  /FROM "test_case" WHERE id IN \(.*\) ORDER BY id FOR NO KEY UPDATE$/;

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

const QUEUED_AT = new Date('2026-10-20T08:00:00.000Z');

/** A target case as the job reads it under the lock: queued for this run. */
function caseRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    suiteId: 'suite-1',
    name: `Old ${id}`,
    documentationSource: 'ingestion',
    documentationQueuedAt: QUEUED_AT as Date | null,
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
  const prisma = {
    /** Transactions whose callback resolved, the fake's notion of a commit. */
    commits: 0,
    codeChange: { findFirst: jest.fn().mockResolvedValue(null) },
    testCase: {
      findUnique: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        project: { organizationId: 'org-1', connection },
      }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(async (run: (client: FakeTx) => unknown) => {
      const result = await run(tx);
      prisma.commits += 1;
      return result;
    }),
  };

  return prisma;
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
  const extract = jest.fn().mockResolvedValue({
    kind: 'extracted',
    cases: extracted,
    suite: null,
    usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
  });
  const extractor = {
    extract,
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
    reclassifier as never,
  );

  const log = jest
    .spyOn(processor['logger'], 'log')
    .mockImplementation(() => undefined);
  jest.spyOn(processor['logger'], 'warn').mockImplementation(() => undefined);
  jest.spyOn(processor['logger'], 'error').mockImplementation(() => undefined);

  return { processor, entitlement, reclassifier, extract, log };
}

function documentFileJob(
  attempt = { attemptsStarted: 1, attempts: 3 },
  jobTargets: { testCaseId: string; automationKey: string }[] = targets,
) {
  return {
    data: { kind: 'document-file', filePath: FILE_PATH, targets: jobTargets },
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

  it('looks for pending proposals inside the transaction, after the lock, with the rule the suite shows', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await processor.process(documentFileJob());

    expect(tx.extractedProposal.findMany).toHaveBeenCalledWith({
      where: {
        status: 'in_review',
        needsManualReview: false,
        OR: [
          { targetTestCaseId: { in: ['case-1', 'case-2'] } },
          { matchedCaseId: { in: ['case-1', 'case-2'] } },
        ],
      },
      select: { targetTestCaseId: true, matchedCaseId: true },
    });
    const [pendingOrder] =
      tx.extractedProposal.findMany.mock.invocationCallOrder;
    expect(pendingOrder).toBeGreaterThan(lockCallOrder(tx));
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

describe('ExtractionProcessor — a run only writes the cases it still owns', () => {
  const documented = extracted[0];

  it('reads the queued marker of each case under the lock', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await processor.process(documentFileJob());

    const [read] = tx.testCase.findMany.mock.calls as [
      { select: Record<string, unknown> },
    ][];
    expect(read[0].select).toMatchObject({ documentationQueuedAt: true });
  });

  it('leaves alone a case an approval published after the job was queued, keeping the approval outcome', async () => {
    // The approval cleared the marker and published its own version.
    const tx = createTx([
      caseRow('case-1', {
        documentationQueuedAt: null,
        currentVersion: { ...documented, title: 'Approved by a reviewer' },
      }),
      caseRow('case-2'),
    ]);
    const prisma = createPrisma(tx);
    const { processor, log } = build(prisma);

    await processor.process(documentFileJob());

    expect(publishedCaseIds(tx)).toEqual(['case-2']);
    expect(caseWrite(tx, 'case-1')).toBeUndefined();
    expect(tx.extractedProposal.deleteMany).not.toHaveBeenCalledWith({
      where: expect.objectContaining({ targetTestCaseId: 'case-1' }) as unknown,
    });
    expect(log).toHaveBeenCalledWith(
      `Skipped documenting 1 case(s) in ${FILE_PATH}: superseded, their documentation run is no longer queued`,
    );
  });

  it('documents a case again once someone queued a new run after the approval', async () => {
    const tx = createTx([
      caseRow('case-1', {
        currentVersion: { ...documented, title: 'Approved by a reviewer' },
      }),
      caseRow('case-2'),
    ]);
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await processor.process(documentFileJob());

    expect(publishedCaseIds(tx)).toEqual(['case-1', 'case-2']);
  });

  it('publishes nothing when a retried job finds its first attempt already committed', async () => {
    const tx = createTx([
      caseRow('case-1', { documentationQueuedAt: null }),
      caseRow('case-2', { documentationQueuedAt: null }),
    ]);
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await processor.process(
      documentFileJob({ attemptsStarted: 2, attempts: 3 }),
    );

    expect(publishedCaseIds(tx)).toEqual([]);
    expect(tx.testCase.update).not.toHaveBeenCalled();
  });
});

describe('ExtractionProcessor — document-file write-time pending check', () => {
  it('skips a case that got a proposal in review after the job was queued', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    tx.extractedProposal.findMany.mockResolvedValue([
      { targetTestCaseId: 'case-1', matchedCaseId: null },
    ]);
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await processor.process(documentFileJob());

    expect(publishedCaseIds(tx)).toEqual(['case-2']);
    expect(caseWrite(tx, 'case-1')).toMatchObject({
      documentationOutcome: 'skipped',
      documentationSkipReason: 'already-pending',
      documentationQueuedAt: null,
    });
  });

  it('skips a case a possible duplicate in review was matched to', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    tx.extractedProposal.findMany.mockResolvedValue([
      { targetTestCaseId: null, matchedCaseId: 'case-2' },
    ]);
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await processor.process(documentFileJob());

    expect(publishedCaseIds(tx)).toEqual(['case-1']);
    expect(caseWrite(tx, 'case-2')).toMatchObject({
      documentationOutcome: 'skipped',
      documentationSkipReason: 'already-pending',
    });
  });

  it('still documents every case when nothing is waiting for review', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await processor.process(documentFileJob());

    expect(publishedCaseIds(tx)).toEqual(['case-1', 'case-2']);
  });
});

describe('ExtractionProcessor — documentation jobs that lose a transaction conflict', () => {
  function deadlock(): Error {
    return Object.assign(new Error('deadlock detected'), {
      name: 'DriverAdapterError',
      cause: {
        kind: 'postgres',
        code: '40P01',
        originalCode: '40P01',
        originalMessage: 'deadlock detected',
      },
    });
  }

  function failureWrites(prisma: FakePrisma): Record<string, unknown>[] {
    return (
      prisma.testCase.updateMany.mock.calls as [
        { data: Record<string, unknown> },
      ][]
    )
      .map(([call]) => call.data)
      .filter((data) => data.documentationOutcome === 'failed');
  }

  it('runs only the transaction again, once, when the conflict clears on the next attempt', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    tx.testCase.update.mockRejectedValueOnce(deadlock());
    const prisma = createPrisma(tx);
    const { processor, extract } = build(prisma);

    await expect(processor.process(documentFileJob())).resolves.toBeUndefined();

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.commits).toBe(1);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(failureWrites(prisma)).toEqual([]);
  });

  it('hands the job back to the queue only once every in-process attempt lost', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    tx.testCase.update.mockRejectedValue(deadlock());
    const prisma = createPrisma(tx);
    const { processor, extract } = build(prisma);

    await expect(processor.process(documentFileJob())).rejects.toBeInstanceOf(
      RetryableTransactionConflictError,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.commits).toBe(0);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(failureWrites(prisma)).toEqual([]);
  });

  it('does not run the extraction again or publish twice when a conflict hits after the commit', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    const prisma = createPrisma(tx);
    // Recording the target the model never returned is the first write after
    // the commit; it loses a deadlock once.
    prisma.testCase.updateMany.mockRejectedValueOnce(deadlock());
    const { processor, extract } = build(prisma);
    const withUnmatchedTarget = [
      ...targets,
      { testCaseId: 'case-3', automationKey: 'Cart > empties the cart' },
    ];

    await expect(
      processor.process(documentFileJob(undefined, withUnmatchedTarget)),
    ).resolves.toBeUndefined();

    expect(prisma.commits).toBe(1);
    expect(publishedCaseIds(tx)).toEqual(['case-1', 'case-2']);
    // One run: the first call and the retry round for the unmatched target.
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it('retries a serialization failure the same way', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    tx.$executeRawUnsafe.mockRejectedValue(
      Object.assign(new Error('write conflict'), { code: 'P2034' }),
    );
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await expect(processor.process(documentFileJob())).rejects.toBeInstanceOf(
      RetryableTransactionConflictError,
    );
  });

  it('records the failure on the last attempt instead of retrying forever', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    tx.testCase.update.mockRejectedValue(deadlock());
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await expect(
      processor.process(documentFileJob({ attemptsStarted: 3, attempts: 3 })),
    ).resolves.toBeUndefined();
    expect(failureWrites(prisma)).toEqual([
      expect.objectContaining({ documentationSkipReason: 'extraction-failed' }),
    ]);
  });

  it('keeps recording any other unexpected error as a failure', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    tx.testCase.update.mockRejectedValue(new Error('boom'));
    const prisma = createPrisma(tx);
    const { processor } = build(prisma);

    await expect(processor.process(documentFileJob())).resolves.toBeUndefined();
    expect(failureWrites(prisma)).toHaveLength(1);
  });

  describe('document-case', () => {
    function documentCaseJob(attempt = { attemptsStarted: 1, attempts: 3 }) {
      return {
        data: { kind: 'document-case', testCaseId: 'case-1' },
        attemptsStarted: attempt.attemptsStarted,
        opts: { attempts: attempt.attempts },
      } as never;
    }

    function documentCasePrisma() {
      const prisma = createPrisma(createTx([]));
      prisma.testCase.findUnique.mockResolvedValue({
        id: 'case-1',
        projectId: 'project-1',
        suiteId: 'suite-1',
        name: 'Old case-1',
        automationKey: 'Cart > adds an item',
        automationFilePath: FILE_PATH,
        automationClassName: null,
        suite: { name: 'Cart' },
        project: { organizationId: 'org-1', connection },
      });
      return prisma;
    }

    it('throws a retryable error when persisting its proposal deadlocks', async () => {
      const prisma = documentCasePrisma();
      const { processor } = build(prisma);
      jest
        .spyOn(processor['proposalWriter'], 'persistExtracted')
        .mockRejectedValue(deadlock());

      await expect(processor.process(documentCaseJob())).rejects.toBeInstanceOf(
        RetryableTransactionConflictError,
      );
      expect(failureWrites(prisma)).toEqual([]);
    });

    it('records the failure on the last attempt', async () => {
      const prisma = documentCasePrisma();
      const { processor } = build(prisma);
      jest
        .spyOn(processor['proposalWriter'], 'persistExtracted')
        .mockRejectedValue(deadlock());

      await expect(
        processor.process(documentCaseJob({ attemptsStarted: 3, attempts: 3 })),
      ).resolves.toBeUndefined();
      expect(failureWrites(prisma)).toHaveLength(1);
    });
  });
});

describe('ExtractionProcessor — reclassifying after documenting', () => {
  function recordingReclassifier(prisma: FakePrisma) {
    const commitsSeen: number[] = [];
    const enqueue = jest.fn(() => {
      commitsSeen.push(prisma.commits);
      return Promise.resolve();
    });
    return { reclassifier: { enqueue }, commitsSeen };
  }

  it('reclassifies the suite of the cases it documented, once the transaction has committed', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    const prisma = createPrisma(tx);
    const { reclassifier, commitsSeen } = recordingReclassifier(prisma);
    const { processor } = build(prisma, fakeEntitlement(), reclassifier);

    await processor.process(documentFileJob());

    expect(reclassifier.enqueue.mock.calls).toEqual([['suite-1']]);
    expect(commitsSeen).toEqual([1]);
  });

  it('reclassifies each suite the documented cases belong to', async () => {
    const tx = createTx([
      caseRow('case-1'),
      caseRow('case-2', { suiteId: 'suite-2' }),
    ]);
    const prisma = createPrisma(tx);
    const { reclassifier } = recordingReclassifier(prisma);
    const { processor } = build(prisma, fakeEntitlement(), reclassifier);

    await processor.process(documentFileJob());

    expect(reclassifier.enqueue.mock.calls).toEqual([['suite-1'], ['suite-2']]);
  });

  it('reclassifies nothing when every case was skipped', async () => {
    const tx = createTx([
      caseRow('case-1', { documentationSource: 'human' }),
      caseRow('case-2'),
    ]);
    tx.extractedProposal.findMany.mockResolvedValue([
      { targetTestCaseId: 'case-2', matchedCaseId: null },
    ]);
    const prisma = createPrisma(tx);
    const { reclassifier } = recordingReclassifier(prisma);
    const { processor } = build(prisma, fakeEntitlement(), reclassifier);

    await processor.process(documentFileJob());

    expect(reclassifier.enqueue).not.toHaveBeenCalled();
  });

  it('reclassifies nothing when the transaction rolled back', async () => {
    const tx = createTx([caseRow('case-1'), caseRow('case-2')]);
    tx.testCase.update.mockRejectedValue(new Error('boom'));
    const prisma = createPrisma(tx);
    const { reclassifier } = recordingReclassifier(prisma);
    const { processor } = build(prisma, fakeEntitlement(), reclassifier);

    await processor.process(documentFileJob());

    expect(reclassifier.enqueue).not.toHaveBeenCalled();
  });
});
