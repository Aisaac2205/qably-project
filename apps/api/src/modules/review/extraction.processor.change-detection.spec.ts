import { Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { Env } from '../../config/env';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { AiDailyBudget } from '../ai/ai-daily-budget.service';
import type { AiEntitlementService } from '../ai/ai-entitlement.service';
import type {
  ExtractedCase,
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

/** A test body generator that rewrites the assertion of one test only. */
const changing = (changed: string) => (title: string) =>
  title === changed
    ? `expect('${title}').toBe('rewritten');`
    : `expect('${title}').toBeTruthy();`;

function extracted(cases: readonly ExtractedCase[]): ExtractionOutcome {
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
      case 'extractedAt':
        if ((condition as { not?: unknown }).not !== null) {
          throw new Error('the fake store only filters stamped pushes');
        }
        return row.extractedAt !== null;
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

type OrderBy = Record<string, 'asc' | 'desc'>;

function compareRows(
  a: StoredChange,
  b: StoredChange,
  orderBy: OrderBy | OrderBy[],
): number {
  for (const clause of Array.isArray(orderBy) ? orderBy : [orderBy]) {
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
  orderBy?: OrderBy | OrderBy[];
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
      findUnique: jest.fn().mockResolvedValue(null),
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
  /** Another job than the code change named by the id. */
  data?: Record<string, unknown>;
}

function harness() {
  const changes = new Map<string, StoredChange>();
  const sources = new Map<string, string>();
  const unreadable = new Set<string>();
  /** Commits the reader cuts at the plan limit. */
  const truncated = new Set<string>();
  const prisma = fakePrisma(changes);
  const extract = jest.fn<Promise<ExtractionOutcome>, [ExtractionInput]>();
  const tryConsume = jest.fn().mockResolvedValue(true);
  const spendCredit = jest.fn().mockResolvedValue(true);
  const read = jest.fn((input: { ref: string }) => {
    const content = sources.get(input.ref);
    if (content === undefined || unreadable.has(input.ref)) {
      return Promise.resolve({ kind: 'unavailable', reason: 'fetch-failed' });
    }
    return Promise.resolve({
      kind: 'content',
      content,
      truncated: truncated.has(input.ref),
    });
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
      data: options.data ?? {
        kind: 'code-change',
        codeChangeId: id,
        locale: 'en',
      },
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
    truncated,
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
    expect(store.extract.mock.calls[0][0].targetDeclarations).toBeUndefined();
    expect(store.changes.get('change-1')?.extractedAt).toBeInstanceOf(Date);
    expect(store.changes.get('change-1')?.declarationSnapshot).toBeNull();
  });
});

/** Describes exactly the declarations a targeted request names, tagged. */
function answerTargets(input: ExtractionInput): ExtractionOutcome {
  const targets = input.targetDeclarations ?? [];
  return extracted(
    targets.map((target, index) => ({
      ...extractedCase([...target.describePath, target.title].join(' ')),
      targetRef: `T${index + 1}`,
    })),
  );
}

/** The titles each model call asked for, one list per call. */
function requestedTitles(store: ReturnType<typeof harness>): string[][] {
  return store.extract.mock.calls.map(([input]) =>
    (input.targetDeclarations ?? []).map(({ title }) => title),
  );
}

const numbered = (count: number, prefix = 'case') =>
  Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);

/** A first push of the file, extracted and stamped with its snapshot. */
async function extractedFirstPush(
  store: ReturnType<typeof harness>,
  content: string,
): Promise<void> {
  store.push('change-1', 1, content);
  await store.run('change-1', { answer: answerTargets });
  expect(store.changes.get('change-1')?.extractedAt).toBeInstanceOf(Date);
  store.extract.mockClear();
  store.tryConsume.mockClear();
  store.spendCredit.mockClear();
  store.read.mockClear();
  store.prisma.extractedProposal.create.mockClear();
}

describe('ExtractionProcessor — a code change sends only new or changed tests to the model', () => {
  const FORTY = numbered(40);
  const changedSeventh = changing('case 7');
  const THREE = numbered(3);
  const changedSecond = changing('case 2');

  it('sends one target and writes one proposal when one test of forty changed', async () => {
    const store = harness();
    quietLogs();
    await extractedFirstPush(store, testFile(FORTY));
    store.push('change-2', 2, testFile(FORTY, { body: changedSeventh }));

    await store.run('change-2', { answer: answerTargets });

    expect(requestedTitles(store)).toEqual([['case 7']]);
    expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
    expect(store.tryConsume).toHaveBeenCalledTimes(1);
    expect(store.spendCredit).toHaveBeenCalledTimes(1);
    expect(store.changes.get('change-2')?.extractedAt).toBeInstanceOf(Date);
    expect(store.snapshotOf('change-2')?.removed).toEqual([]);
  });

  it('describes a whole file the first time, in chunks of at most twenty, and stamps it', async () => {
    const store = harness();
    store.push('change-1', 1, testFile(FORTY));
    quietLogs();

    await store.run('change-1', { answer: answerTargets });

    expect(requestedTitles(store)).toEqual([
      numbered(20),
      numbered(40).slice(20),
    ]);
    expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(40);
    expect(store.tryConsume).toHaveBeenCalledTimes(2);
    expect(store.spendCredit).toHaveBeenCalledTimes(1);
    expect(store.changes.get('change-1')?.extractedAt).toBeInstanceOf(Date);
  });

  it('splits forty-five changed tests into three model calls and persists all of them', async () => {
    const store = harness();
    store.push('change-1', 1, testFile(numbered(45)));
    quietLogs();

    await store.run('change-1', { answer: answerTargets });

    expect(requestedTitles(store).map((titles) => titles.length)).toEqual([
      20, 20, 5,
    ]);
    expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(45);
    expect(store.changes.get('change-1')?.extractedAt).toBeInstanceOf(Date);
  });

  it('sends only the tests of the describe whose hook changed', async () => {
    const twoDescribes = (hook: string) =>
      [
        "describe('Cart', () => {",
        `  beforeEach(() => { ${hook}; });`,
        "  it('adds', () => { expect(1).toBe(1); });",
        "  it('removes', () => { expect(0).toBe(0); });",
        '});',
        "describe('Checkout', () => {",
        "  it('pays', () => { expect(2).toBe(2); });",
        '});',
      ].join('\n');
    const store = harness();
    quietLogs();
    await extractedFirstPush(store, twoDescribes('reset()'));
    store.push('change-2', 2, twoDescribes('reset(true)'));

    await store.run('change-2', { answer: answerTargets });

    expect(requestedTitles(store)).toEqual([['adds', 'removes']]);
  });

  it('sends every test when the file context changed', async () => {
    const titles = numbered(3);
    const store = harness();
    quietLogs();
    await extractedFirstPush(store, testFile(titles));
    store.push(
      'change-2',
      2,
      testFile(titles, {
        header:
          "import { it, describe } from '@jest/globals';\nconst total = 2;",
      }),
    );

    await store.run('change-2', { answer: answerTargets });

    expect(requestedTitles(store)).toEqual([titles]);
  });

  it('sends a new test and records a removed one without extracting it', async () => {
    const store = harness();
    quietLogs();
    await extractedFirstPush(store, testFile(['keeps', 'drops']));
    store.push('change-2', 2, testFile(['keeps', 'arrives']));

    await store.run('change-2', { answer: answerTargets });

    expect(requestedTitles(store)).toEqual([['arrives']]);
    expect(store.snapshotOf('change-2')?.removed).toEqual([
      {
        id: JSON.stringify([['Cart'], 'drops', 0]),
        title: 'drops',
        describePath: ['Cart'],
      },
    ]);
  });

  it('spends no budget, model call or credit when no test changed, and still stamps the push', async () => {
    const store = harness();
    const { log } = quietLogs();
    await extractedFirstPush(store, testFile(FORTY));
    store.push(
      'change-2',
      2,
      testFile(FORTY, {
        header:
          "// imports reordered\nimport { describe, expect, it } from '@jest/globals';",
      }),
    );

    await store.run('change-2', { answer: answerTargets });

    expect(store.extract).not.toHaveBeenCalled();
    expect(store.tryConsume).not.toHaveBeenCalled();
    expect(store.spendCredit).not.toHaveBeenCalled();
    expect(store.prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(store.changes.get('change-2')?.extractedAt).toBeInstanceOf(Date);
    expect(store.snapshotOf('change-2')?.declarations).toHaveLength(40);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('none of its 40 test declarations changed'),
    );
  });

  describe('the baseline it compares with', () => {
    it('is the snapshot of the previous push, with no extra source read', async () => {
      const store = harness();
      quietLogs();
      await extractedFirstPush(store, testFile(FORTY));
      store.push('change-2', 2, testFile(FORTY, { body: changedSeventh }));

      await store.run('change-2', { answer: answerTargets });

      expect(store.read.mock.calls.map(([input]) => input.ref)).toEqual([
        'sha-change-2',
      ]);
    });

    it('is the source of the previous commit when that push was extracted before snapshots existed', async () => {
      const store = harness();
      quietLogs();
      const old = store.push('change-1', 1, testFile(FORTY));
      Object.assign(old, { sourceHash: 'old-hash', extractedAt: new Date() });
      store.push('change-2', 2, testFile(FORTY, { body: changedSeventh }));

      await store.run('change-2', { answer: answerTargets });

      expect(store.read.mock.calls.map(([input]) => input.ref)).toEqual([
        'sha-change-2',
        'sha-change-1',
      ]);
      expect(requestedTitles(store)).toEqual([['case 7']]);
      expect(store.snapshotOf('change-2')?.removed).toEqual([]);
    });

    it('is nothing while the previous push is still in flight, so every test is sent', async () => {
      const store = harness();
      quietLogs();
      const inFlight = store.push('change-1', 1, testFile(THREE));
      Object.assign(inFlight, { sourceHash: 'in-flight', extractedAt: null });
      store.push('change-2', 2, testFile(THREE, { body: changedSecond }));

      await store.run('change-2', { answer: answerTargets });

      expect(requestedTitles(store)).toEqual([THREE]);
      expect(store.snapshotOf('change-2')?.removed).toBeNull();
    });

    it('is nothing when the previous commit cannot be read, so every test is sent', async () => {
      const store = harness();
      const { warn } = quietLogs();
      const old = store.push('change-1', 1, testFile(THREE));
      Object.assign(old, { sourceHash: 'old-hash', extractedAt: new Date() });
      store.unreadable.add('sha-change-1');
      store.push('change-2', 2, testFile(THREE, { body: changedSecond }));

      await store.run('change-2', { answer: answerTargets });

      expect(requestedTitles(store)).toEqual([THREE]);
      expect(store.changes.get('change-2')?.extractedAt).toBeInstanceOf(Date);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('fetch-failed'),
      );
    });

    it('is the previous push of the same branch, so a merge after a skipped branch push compares with the default branch', async () => {
      const store = harness();
      quietLogs();
      await extractedFirstPush(store, testFile(FORTY));
      store.push('change-2', 2, testFile(FORTY, { body: changedSeventh }), {
        branch: 'feature/seven',
      });
      store.push('change-3', 3, testFile(FORTY, { body: changedSeventh }));

      await store.run('change-3', { answer: answerTargets });

      expect(requestedTitles(store)).toEqual([['case 7']]);
    });

    it('is the latest stamped push of any branch for the first push of a new branch', async () => {
      const store = harness();
      quietLogs();
      await extractedFirstPush(store, testFile(FORTY));
      store.push('change-2', 2, testFile(FORTY, { body: changedSeventh }), {
        branch: 'feature/new',
      });

      await store.run('change-2', { answer: answerTargets });

      expect(requestedTitles(store)).toEqual([['case 7']]);
    });

    it('is the extracted branch push for the first default-branch push after it, when the default branch was unknown', async () => {
      const store = harness();
      quietLogs();
      const onBranch = testFile(FORTY, { body: changedSeventh });
      store.push('change-1', 1, onBranch, { branch: 'feature/seven' });
      await store.run('change-1', { answer: answerTargets });
      store.extract.mockClear();
      const merged = testFile(FORTY, {
        body: (title) =>
          title === 'case 8'
            ? "expect('case 8').toBe('merged');"
            : changedSeventh(title),
      });
      store.push('change-2', 2, merged);

      await store.run('change-2', { answer: answerTargets });

      expect(requestedTitles(store)).toEqual([['case 8']]);
    });

    it('compares a merge with the default branch even when the branch push was extracted', async () => {
      const store = harness();
      quietLogs();
      await extractedFirstPush(store, testFile(FORTY));
      store.push('change-2', 2, testFile(FORTY, { body: changedSeventh }), {
        branch: 'feature/seven',
      });
      await store.run('change-2', { answer: answerTargets });
      store.extract.mockClear();
      store.push('change-3', 3, testFile(FORTY, { body: changedSeventh }));

      await store.run('change-3', { answer: answerTargets });

      expect(requestedTitles(store)).toEqual([['case 7']]);
    });

    it('is the latest stamped push of any branch for a push with no known branch', async () => {
      const store = harness();
      quietLogs();
      await extractedFirstPush(store, testFile(FORTY));
      store.push('change-2', 2, testFile(FORTY), { branch: 'feature/other' });
      store.push('change-3', 3, testFile(FORTY, { body: changedSeventh }), {
        branch: null,
      });

      await store.run('change-3', { answer: answerTargets });

      expect(requestedTitles(store)).toEqual([['case 7']]);
    });

    it.each([
      ['was cut by the reader', 'cut'],
      ['is too long for every plan to have read it whole', 'long'],
    ])(
      'is nothing when the previous commit, rebuilt from source, %s',
      async (_label, kind) => {
        const store = harness();
        quietLogs();
        const header =
          kind === 'long'
            ? `import { describe, expect, it } from '@jest/globals';\n// ${'x'.repeat(60_000)}`
            : undefined;
        const old = store.push('change-1', 1, testFile(THREE, { header }));
        Object.assign(old, { sourceHash: 'old', extractedAt: new Date() });
        if (kind === 'cut') store.truncated.add('sha-change-1');
        store.push(
          'change-2',
          2,
          testFile(THREE, { header, body: changedSecond }),
        );

        await store.run('change-2', { answer: answerTargets });

        expect(requestedTitles(store)).toEqual([THREE]);
      },
    );

    it('is nothing when the lookup fails, and the job still extracts', async () => {
      const store = harness();
      const { warn } = quietLogs();
      await extractedFirstPush(store, testFile(THREE));
      store.push('change-2', 2, testFile(THREE, { body: changedSecond }));
      store.prisma.codeChange.findFirst.mockRejectedValueOnce(
        new Error('db gone'),
      );

      await store.run('change-2', { answer: answerTargets });

      expect(requestedTitles(store)).toEqual([THREE]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('db gone'));
    });
  });

  describe('an incomplete answer', () => {
    it('persists what matched but leaves the push unstamped when the model skipped a target', async () => {
      const store = harness();
      store.push('change-1', 1, testFile(numbered(3)));
      quietLogs();

      await store.run('change-1', {
        answer: (input) => {
          const full = answerTargets(input);
          return full.kind === 'extracted'
            ? { ...full, cases: full.cases.slice(0, 2) }
            : full;
        },
      });

      expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(2);
      expect(store.changes.get('change-1')?.extractedAt).toBeNull();
      expect(store.changes.get('change-1')?.declarationSnapshot).toBeNull();
    });

    it('drops a case for a test it was not asked about', async () => {
      const store = harness();
      quietLogs();
      await extractedFirstPush(store, testFile(THREE));
      store.push('change-2', 2, testFile(THREE, { body: changing('case 3') }));

      await store.run('change-2', {
        answer: (input) => {
          const full = answerTargets(input);
          return full.kind === 'extracted'
            ? {
                ...full,
                cases: [...full.cases, extractedCase('Cart case 1')],
              }
            : full;
        },
      });

      expect(requestedTitles(store)).toEqual([['case 3']]);
      expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
      expect(store.changes.get('change-2')?.extractedAt).toBeInstanceOf(Date);
    });

    it('drops an unchanged test the model tagged as the requested one, and does not stamp', async () => {
      const store = harness();
      quietLogs();
      await extractedFirstPush(store, testFile(THREE));
      store.push('change-2', 2, testFile(THREE, { body: changing('case 3') }));

      await store.run('change-2', {
        answer: () =>
          extracted([
            {
              ...extractedCase('Cart case 1'),
              sourceExcerpt: "expect('case 1').toBeTruthy();",
              targetRef: 'T1',
            },
          ]),
      });

      expect(requestedTitles(store)).toEqual([['case 3']]);
      expect(store.prisma.extractedProposal.create).not.toHaveBeenCalled();
      expect(store.changes.get('change-2')?.extractedAt).toBeNull();
    });

    it('persists the chunks that ran and leaves the push unstamped when the daily budget runs out', async () => {
      const store = harness();
      store.push('change-1', 1, testFile(numbered(25)));
      quietLogs();
      store.tryConsume.mockResolvedValueOnce(true).mockResolvedValue(false);

      await store.run('change-1', { answer: answerTargets });

      expect(store.extract).toHaveBeenCalledTimes(1);
      expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(20);
      expect(store.changes.get('change-1')?.extractedAt).toBeNull();
    });

    it('records the reason and spends nothing when the budget refuses the first call', async () => {
      const store = harness();
      store.push('change-1', 1, testFile(numbered(3)));
      const { warn } = quietLogs();
      store.tryConsume.mockResolvedValue(false);

      await store.run('change-1', { answer: answerTargets });

      expect(store.extract).not.toHaveBeenCalled();
      expect(store.spendCredit).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('quota-exhausted'),
      );
    });

    it('retries the whole job on a retryable failure, charging the budget only on the first attempt', async () => {
      const store = harness();
      store.push('change-1', 1, testFile(numbered(25)));
      quietLogs();
      let call = 0;
      const flaky = (input: ExtractionInput): ExtractionOutcome => {
        call += 1;
        return call === 2
          ? {
              kind: 'provider-unavailable',
              reason: 'rate-limited',
              retryable: true,
            }
          : answerTargets(input);
      };

      await expect(store.run('change-1', { answer: flaky })).rejects.toThrow(
        'provider-unavailable:rate-limited',
      );
      expect(store.prisma.extractedProposal.create).not.toHaveBeenCalled();
      expect(store.tryConsume).toHaveBeenCalledTimes(2);

      await store.run('change-1', { answer: flaky, attemptsStarted: 2 });

      expect(store.tryConsume).toHaveBeenCalledTimes(2);
      expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(25);
      expect(store.changes.get('change-1')?.extractedAt).toBeInstanceOf(Date);
    });
  });

  it('leaves a document-case request on its own flow, even for a file the parser reads', async () => {
    const store = harness();
    store.push('change-1', 1, testFile(THREE));
    quietLogs();
    store.prisma.testCase.findUnique.mockResolvedValue({
      id: 'case-1',
      projectId: 'project-1',
      suiteId: 'suite-1',
      name: 'case 2',
      automationKey: 'Cart case 2',
      automationFilePath: FILE_PATH,
      automationClassName: null,
      suite: { name: 'Cart' },
      project: { organizationId: 'org-1', connection },
    });

    await store.run('change-1', {
      data: { kind: 'document-case', testCaseId: 'case-1', locale: 'en' },
      answer: () => extracted([extractedCase('Cart case 2')]),
    });

    expect(store.extract).toHaveBeenCalledTimes(1);
    const [input] = store.extract.mock.calls[0];
    expect(input.targetDeclarations).toBeUndefined();
    expect(input.automationKey).toBe('Cart case 2');
    expect(store.prisma.codeChange.updateMany).not.toHaveBeenCalled();
    expect(store.prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
  });
});
