import type { AiDailyBudget } from '../ai/ai-daily-budget.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { TestCaseExtractor } from '../ai/extraction.contracts';
import type { SourceReader } from '../repository/source-reader';
import type { TestFileLocator } from '../repository/test-file-locator';
import {
  createCaseNameStore,
  type CaseNameStore,
  type StoredCase,
} from '../../../test/support/case-name-store';
import { testCaseAutomationKeyViolation } from '../../../test/support/prisma-unique-violation';
import { ExtractionFailureRecorder } from './extraction-failure-recorder';
import { ExtractedProposalWriter } from './extracted-proposal-writer';
import { ExtractionProcessor } from './extraction.processor';

const FILE_PATH = 'src/cart.spec.ts';
const SUITE_ID = 'suite-1';

const connection = {
  provider: 'GITHUB' as const,
  repo: 'qably/qably',
  encryptedAccessToken: null as string | null,
};

const targets = [1, 2, 3, 4, 5].map((n) => ({
  testCaseId: `case-${n}`,
  automationKey: `Cart > test ${n}`,
}));

function extractedCase(n: number, title = `Title ${n}`) {
  return {
    automationKey: `Cart > test ${n}`,
    title,
    objective: `Verify behaviour ${n}`,
    preconditions: [],
    steps: ['Do the thing'],
    expectedResult: 'It works',
    priority: 'medium',
    sourceExcerpt: `it('test ${n}', () => {})`,
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

function fiveTitles(titles: readonly string[] = []) {
  return extractedOutcome(
    [1, 2, 3, 4, 5].map((n) => extractedCase(n, titles[n - 1])),
  );
}

function seedCases(ghostNames: readonly string[] = []): StoredCase[] {
  const own = [1, 2, 3, 4, 5].map(
    (n): StoredCase => ({
      id: `case-${n}`,
      suiteId: SUITE_ID,
      name: `Old ${n}`,
      automationKey: `Cart > test ${n}`,
    }),
  );
  const ghosts = ghostNames.map(
    (name, index): StoredCase => ({
      id: `ghost-${index + 1}`,
      suiteId: SUITE_ID,
      name,
      automationKey: `Cart > removed ${index + 1}`,
    }),
  );

  return [...own, ...ghosts];
}

function createPrisma(store: CaseNameStore) {
  const rows = store
    .committed()
    .cases.filter((row) => row.id.startsWith('case-'));

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
    codeChange: { findFirst: jest.fn().mockResolvedValue(null) },
    testCase: {
      findUnique: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        project: { organizationId: 'org-1', connection },
      }),
      findMany: jest.fn().mockResolvedValue(
        rows.map((row) => ({
          id: row.id,
          suiteId: row.suiteId,
          name: row.name,
          documentationSource: 'ingestion',
          currentVersion: null,
        })),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(store.transaction),
  };

  return prisma;
}

type FakePrisma = ReturnType<typeof createPrisma>;

function build(prisma: FakePrisma, extractor: TestCaseExtractor) {
  const entitlement = new AiEntitlementService(prisma as never);
  const sourceReader = {
    read: jest.fn().mockResolvedValue({
      kind: 'content',
      content: 'body',
      truncated: false,
    }),
  } as unknown as SourceReader;

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

function extractorReturning(outcome: ReturnType<typeof fiveTitles>) {
  return {
    extract: jest.fn().mockResolvedValue(outcome),
    summarizeSuite: jest.fn(),
  } as unknown as TestCaseExtractor;
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

function failureWrites(prisma: FakePrisma): FailureWrite[] {
  return (prisma.testCase.updateMany.mock.calls as [FailureWrite][])
    .map(([write]) => write)
    .filter((write) => write.data.documentationOutcome === 'failed');
}

function namesOf(store: CaseNameStore): Record<string, string> {
  return Object.fromEntries(
    store
      .committed()
      .cases.filter((row) => row.id.startsWith('case-'))
      .map((row) => [row.id, row.name]),
  );
}

function warnings(warn: jest.SpyInstance): string[] {
  return (warn.mock.calls as [string][]).map(([message]) => message);
}

describe('ExtractionProcessor — a name collision never loses the sibling cases', () => {
  it('documents all five cases and keeps the old name of the third when its title is held by another case', async () => {
    const store = createCaseNameStore(seedCases(['Title 3']));
    const prisma = createPrisma(store);
    const { processor } = build(prisma, extractorReturning(fiveTitles()));

    await processor.process(documentFileJob());

    expect(namesOf(store)).toEqual({
      'case-1': 'Title 1',
      'case-2': 'Title 2',
      'case-3': 'Old 3',
      'case-4': 'Title 4',
      'case-5': 'Title 5',
    });
    expect(
      store
        .committed()
        .versions.map(({ testCaseId, title }) => [testCaseId, title]),
    ).toEqual([
      ['case-1', 'Title 1'],
      ['case-2', 'Title 2'],
      ['case-3', 'Title 3'],
      ['case-4', 'Title 4'],
      ['case-5', 'Title 5'],
    ]);
  });

  it('keeps the spent credit and records no failure when a title collides', async () => {
    const store = createCaseNameStore(seedCases(['Title 3']));
    const prisma = createPrisma(store);
    const { processor, error } = build(
      prisma,
      extractorReturning(fiveTitles()),
    );

    await processor.process(documentFileJob());

    expect(store.committed().creditsUsed).toBe(1);
    expect(failureWrites(prisma)).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });

  it('marks every case as documented by Aeris, including the one that kept its name', async () => {
    const store = createCaseNameStore(seedCases(['Title 3']));
    const { processor } = build(
      createPrisma(store),
      extractorReturning(fiveTitles()),
    );

    await processor.process(documentFileJob());

    const sources = store
      .committed()
      .cases.filter((row) => row.id.startsWith('case-'))
      .map((row) => row.fields?.documentationSource);
    expect(sources).toEqual(['aeris', 'aeris', 'aeris', 'aeris', 'aeris']);
  });

  it('warns about the case that kept its name, with its key, the proposed title and the holder', async () => {
    const store = createCaseNameStore(seedCases(['Title 3']));
    const { processor, warn } = build(
      createPrisma(store),
      extractorReturning(fiveTitles()),
    );

    await processor.process(documentFileJob());

    expect(warnings(warn)).toContain(
      'Kept the current name "Old 3" of case case-3 (key "Cart > test 3"): the proposed title "Title 3" is already held by case ghost-1 (key "Cart > removed 1")',
    );
  });

  it('falls back for two consecutive collisions and still documents the rest', async () => {
    const store = createCaseNameStore(seedCases(['Title 3', 'Title 4']));
    const prisma = createPrisma(store);
    const { processor } = build(prisma, extractorReturning(fiveTitles()));

    await processor.process(documentFileJob());

    expect(namesOf(store)).toEqual({
      'case-1': 'Title 1',
      'case-2': 'Title 2',
      'case-3': 'Old 3',
      'case-4': 'Old 4',
      'case-5': 'Title 5',
    });
    expect(store.committed().versions).toHaveLength(5);
    expect(store.committed().creditsUsed).toBe(1);
    expect(failureWrites(prisma)).toEqual([]);
  });

  it('falls back for the second of two cases that propose the same title in one job', async () => {
    const store = createCaseNameStore(seedCases());
    const prisma = createPrisma(store);
    const { processor } = build(
      prisma,
      extractorReturning(
        fiveTitles(['Shared', 'Shared', 'Title 3', 'Title 4', 'Title 5']),
      ),
    );

    await processor.process(documentFileJob());

    expect(namesOf(store)).toMatchObject({
      'case-1': 'Shared',
      'case-2': 'Old 2',
    });
    expect(store.committed().versions).toHaveLength(5);
    expect(failureWrites(prisma)).toEqual([]);
  });

  it('documents every case under the new titles when nothing collides', async () => {
    const store = createCaseNameStore(seedCases());
    const { processor, warn } = build(
      createPrisma(store),
      extractorReturning(fiveTitles()),
    );

    await processor.process(documentFileJob());

    expect(namesOf(store)).toEqual({
      'case-1': 'Title 1',
      'case-2': 'Title 2',
      'case-3': 'Title 3',
      'case-4': 'Title 4',
      'case-5': 'Title 5',
    });
    expect(
      warnings(warn).some((message) => message.startsWith('Kept the current')),
    ).toBe(false);
  });

  it('still fails the whole job, credit included, on a unique violation of another constraint', async () => {
    const store = createCaseNameStore(seedCases());
    store.failUpdatesOf('case-3', testCaseAutomationKeyViolation());
    const prisma = createPrisma(store);
    const { processor, error } = build(
      prisma,
      extractorReturning(fiveTitles()),
    );

    await processor.process(documentFileJob());

    expect(store.committed().versions).toEqual([]);
    expect(store.committed().creditsUsed).toBe(0);
    expect(namesOf(store)).toMatchObject({ 'case-1': 'Old 1' });
    const writes = failureWrites(prisma);
    expect(writes).toHaveLength(1);
    expect(writes[0].where.id.in).toEqual([
      'case-1',
      'case-2',
      'case-3',
      'case-4',
      'case-5',
    ]);
    expect(writes[0].data.documentationSkipReason).toBe('extraction-failed');
    expect(
      (error.mock.calls as [string][]).some(([message]) =>
        message.includes('failed unexpectedly'),
      ),
    ).toBe(true);
  });

  it('still fails the whole job on an error that is not a unique violation', async () => {
    const store = createCaseNameStore(seedCases());
    store.failUpdatesOf('case-2', new Error('deadlock detected'));
    const prisma = createPrisma(store);
    const { processor } = build(prisma, extractorReturning(fiveTitles()));

    await processor.process(documentFileJob());

    expect(store.committed().versions).toEqual([]);
    expect(store.committed().creditsUsed).toBe(0);
    expect(failureWrites(prisma)).toHaveLength(1);
  });
});
