import { Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { Env } from '../../config/env';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { AiDailyBudget } from '../ai/ai-daily-budget.service';
import type { AiEntitlementService } from '../ai/ai-entitlement.service';
import type {
  ExtractionInput,
  ExtractionOutcome,
  TestCaseExtractor,
} from '../ai/extraction.contracts';
import type { SourceReader } from '../repository/source-reader';
import type { TestFileLocator } from '../repository/test-file-locator';
import { ExtractionFailureRecorder } from './extraction-failure-recorder';
import { ExtractedProposalWriter } from './extracted-proposal-writer';
import { ExtractionProcessor } from './extraction.processor';
import {
  readDeclarationSnapshot,
  readDeclaredFile,
  type DeclarationSnapshot,
} from './lib/change-detection';

const FILE_PATH = 'src/cart.spec.ts';
const BASE_TIME = Date.parse('2026-10-21T10:00:00.000Z');

const connection = {
  provider: 'GITHUB' as const,
  repo: 'qably/qably',
  encryptedAccessToken: null as string | null,
};

/** A jest file: one describe holding a test per title. */
function testFile(
  titles: readonly string[],
  options: { body?: (title: string) => string; header?: string } = {},
): string {
  const body =
    options.body ?? ((title: string) => `expect('${title}').toBeTruthy();`);
  return [
    options.header ?? "import { expect, it, describe } from '@jest/globals';",
    '',
    "describe('Cart', () => {",
    ...titles.map(
      (title) => `  it('${title}', () => {\n    ${body(title)}\n  });`,
    ),
    '});',
    '',
  ].join('\n');
}

function extractedCase(
  automationKey: string,
  title = `Documents ${automationKey}`,
) {
  return {
    automationKey,
    title,
    objective: 'Verify the cart behaves',
    preconditions: [],
    steps: ['Run the test'],
    expectedResult: 'The test passes',
    priority: 'medium' as const,
    sourceExcerpt: `it('${automationKey}'`,
  };
}

function extracted(
  cases: ReturnType<typeof extractedCase>[],
): ExtractionOutcome {
  return {
    kind: 'extracted',
    cases,
    suite: null,
    usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
  };
}

interface StoredChange {
  id: string;
  projectId: string;
  filePath: string;
  commitSha: string;
  branch: string | null;
  createdAt: Date;
  sourceHash: string | null;
  extractedAt: Date | null;
  declarationSnapshot: unknown;
}

type Where = Record<string, unknown>;

function matchesWhere(row: StoredChange, where: Where): boolean {
  return Object.entries(where).every(([field, condition]) => {
    switch (field) {
      case 'projectId':
      case 'filePath':
        return row[field] === condition;
      case 'id':
        return typeof condition === 'string'
          ? row.id === condition
          : row.id < (condition as { lt: string }).lt;
      case 'createdAt':
        return condition instanceof Date
          ? row.createdAt.getTime() === condition.getTime()
          : row.createdAt < (condition as { lt: Date }).lt;
      case 'OR':
        return (condition as Where[]).some((clause) =>
          matchesWhere(row, clause),
        );
      case 'batch': {
        const scmEvent = (condition as { scmEvent?: { branch?: string } })
          .scmEvent;
        if (scmEvent?.branch === undefined) {
          throw new Error('the fake store only filters a batch by branch');
        }
        return row.branch === scmEvent.branch;
      }
      default:
        throw new Error(`the fake store does not understand "${field}"`);
    }
  });
}

function compareRows(
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

interface QueryArgs {
  where: Where;
  orderBy?: Record<string, 'asc' | 'desc'>[];
  take?: number;
}

/**
 * The code_change table as the processor reads and writes it, applying the
 * real filters and order, plus the proposal side as plain mocks. A database
 * null written through `Prisma.DbNull` reads back as null.
 */
function fakePrisma(changes: Map<string, StoredChange>) {
  const query = (args: QueryArgs): StoredChange[] => {
    const found = [...changes.values()]
      .filter((row) => matchesWhere(row, args.where))
      .sort((a, b) => compareRows(a, b, args.orderBy ?? []));
    return found.slice(0, args.take ?? found.length);
  };

  const prisma = {
    codeChange: {
      findUnique: jest.fn((args: { where: { id: string } }) => {
        const row = changes.get(args.where.id);
        if (row === undefined) return Promise.resolve(null);
        return Promise.resolve({
          ...row,
          evidenceId: 'evidence-blob',
          batchId: 'batch-1',
          batch: {
            scmEvent:
              row.branch === null
                ? null
                : { author: 'ada', branch: row.branch },
          },
          project: { organizationId: 'org-1', connection },
        });
      }),
      findMany: jest.fn((args: QueryArgs) => Promise.resolve(query(args))),
      findFirst: jest.fn((args: QueryArgs) =>
        Promise.resolve(query({ ...args, take: 1 })[0] ?? null),
      ),
      updateMany: jest.fn(
        (args: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = changes.get(args.where.id);
          if (row === undefined) return Promise.resolve({ count: 0 });
          for (const [field, value] of Object.entries(args.data)) {
            (row as unknown as Record<string, unknown>)[field] =
              value === Prisma.DbNull ? null : value;
          }
          return Promise.resolve({ count: 1 });
        },
      ),
    },
    testCase: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    suite: { findFirst: jest.fn().mockResolvedValue({ id: 'suite-1' }) },
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
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };
  prisma.$transaction.mockImplementation(
    (run: (tx: typeof prisma) => unknown) => run(prisma),
  );
  return prisma;
}

interface RunOptions {
  model?: string;
  attemptsStarted?: number;
  answer?: (input: ExtractionInput) => ExtractionOutcome;
}

function harness() {
  const changes = new Map<string, StoredChange>();
  const sources = new Map<string, string>();
  const unreadable = new Set<string>();
  const prisma = fakePrisma(changes);
  const extract = jest.fn<Promise<ExtractionOutcome>, [ExtractionInput]>();
  const tryConsume = jest.fn().mockResolvedValue(true);
  const spendCredit = jest.fn().mockResolvedValue(true);
  const read = jest.fn((input: { ref: string }) => {
    const content = sources.get(input.ref);
    if (content === undefined || unreadable.has(input.ref)) {
      return Promise.resolve({ kind: 'unavailable', reason: 'fetch-failed' });
    }
    return Promise.resolve({ kind: 'content', content, truncated: false });
  });

  /** The n-th push touching the file, one minute after the one before it. */
  function push(
    id: string,
    order: number,
    content: string,
    options: { branch?: string | null } = {},
  ): StoredChange {
    const change: StoredChange = {
      id,
      projectId: 'project-1',
      filePath: FILE_PATH,
      commitSha: `sha-${id}`,
      branch: options.branch === undefined ? 'main' : options.branch,
      createdAt: new Date(BASE_TIME + order * 60_000),
      sourceHash: null,
      extractedAt: null,
      declarationSnapshot: null,
    };
    changes.set(id, change);
    sources.set(change.commitSha, content);
    return change;
  }

  async function run(id: string, options: RunOptions = {}): Promise<void> {
    if (options.answer !== undefined) {
      extract.mockImplementation((input) =>
        Promise.resolve((options.answer as RunOptions['answer'] & {})(input)),
      );
    }
    const entitlement = {
      isEntitled: jest.fn().mockResolvedValue(true),
      spendCredit,
      maxSourceCharacters: jest.fn().mockResolvedValue(60_000),
    } as unknown as AiEntitlementService;
    const extractor: TestCaseExtractor = {
      extract,
      summarizeSuite: jest.fn(),
    };

    await new ExtractionProcessor(
      prisma as never,
      { read } as unknown as SourceReader,
      extractor,
      { decrypt: jest.fn() } as unknown as EncryptionService,
      entitlement,
      { tryConsume } as unknown as AiDailyBudget,
      { locate: jest.fn() } as unknown as TestFileLocator,
      new ExtractionFailureRecorder(prisma as never),
      new ExtractedProposalWriter(
        prisma as never,
        entitlement,
        { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
        { publish: jest.fn() } as never,
      ),
      { GEMINI_MODEL: options.model ?? 'gemini-test' } as Env,
    ).process({
      data: { kind: 'code-change', codeChangeId: id, locale: 'en' },
      attemptsStarted: options.attemptsStarted ?? 1,
      opts: { attempts: 3 },
    } as never);
  }

  function snapshotOf(id: string): DeclarationSnapshot | null {
    return readDeclarationSnapshot(changes.get(id)?.declarationSnapshot);
  }

  return {
    prisma,
    changes,
    sources,
    unreadable,
    push,
    run,
    extract,
    tryConsume,
    spendCredit,
    read,
    snapshotOf,
  };
}

function declarationsOf(content: string) {
  const result = readDeclaredFile({
    filePath: FILE_PATH,
    content,
    truncated: false,
  });
  if (result.kind !== 'declared') throw new Error(result.reason);
  return result.file.declarations;
}

/** Every test of the file described, keyed the jest way. */
const describeEveryTest =
  (titles: readonly string[]) => (): ExtractionOutcome =>
    extracted(titles.map((title) => extractedCase(`Cart ${title}`)));

function quietLogs() {
  return {
    log: jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
    warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ExtractionProcessor — declaration snapshot of a code change', () => {
  const TITLES = ['adds an item', 'removes an item', 'empties the cart'];
  const SOURCE = testFile(TITLES);

  it('stamps a snapshot of every declaration of the file with its extraction', async () => {
    const store = harness();
    store.push('change-1', 1, SOURCE);
    quietLogs();

    await store.run('change-1', { answer: describeEveryTest(TITLES) });

    const snapshot = store.snapshotOf('change-1');
    expect(store.changes.get('change-1')?.extractedAt).toBeInstanceOf(Date);
    expect(snapshot?.declarations).toEqual(declarationsOf(SOURCE));
    expect(snapshot?.fileContextHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot?.removed).toBeNull();
  });

  it('records the snapshot of a push skipped as unchanged, with nothing removed', async () => {
    const store = harness();
    store.push('change-1', 1, SOURCE);
    store.push('change-2', 2, SOURCE);
    quietLogs();

    await store.run('change-1', { answer: describeEveryTest(TITLES) });
    await store.run('change-2');

    expect(store.extract).toHaveBeenCalledTimes(1);
    expect(store.snapshotOf('change-2')?.declarations).toEqual(
      store.snapshotOf('change-1')?.declarations,
    );
    expect(store.snapshotOf('change-2')?.removed).toEqual([]);
  });

  it('clears the snapshot with the stamp when a push delivered again under another model is not extracted', async () => {
    const store = harness();
    store.push('change-1', 1, SOURCE);
    quietLogs();

    await store.run('change-1', {
      model: 'gemini-a',
      answer: describeEveryTest(TITLES),
    });
    expect(store.snapshotOf('change-1')).not.toBeNull();

    await store.run('change-1', {
      model: 'gemini-b',
      answer: () => ({
        kind: 'provider-unavailable',
        reason: 'invalid-credentials',
        retryable: false,
      }),
    });

    expect(store.changes.get('change-1')?.extractedAt).toBeNull();
    expect(store.changes.get('change-1')?.declarationSnapshot).toBeNull();
  });

  it('stamps no snapshot on an extraction that is not stamped', async () => {
    const store = harness();
    store.push('change-1', 1, SOURCE);
    quietLogs();

    await store.run('change-1', { answer: () => ({ kind: 'no-tests-found' }) });

    expect(store.changes.get('change-1')?.extractedAt).toBeNull();
    expect(store.changes.get('change-1')?.declarationSnapshot).toBeNull();
  });

  it.each([
    [
      'a file with a syntax error',
      "describe('Cart', () => {\n  it('adds', () => {",
    ],
    [
      'a file whose tests the parser cannot see',
      "const check = base.extend({});\ncheck('adds', () => {});",
    ],
  ])('stamps %s without a snapshot', async (_label, content) => {
    const store = harness();
    store.push('change-1', 1, content);
    quietLogs();

    await store.run('change-1', {
      answer: () => extracted([extractedCase('adds')]),
    });

    expect(store.extract).toHaveBeenCalledTimes(1);
    expect(store.changes.get('change-1')?.extractedAt).toBeInstanceOf(Date);
    expect(store.changes.get('change-1')?.declarationSnapshot).toBeNull();
  });
});
