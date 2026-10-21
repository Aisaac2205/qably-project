import { Logger } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../common/events/domain-events';
import type { DomainEvents } from '../../common/events/domain-events.service';
import type { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { ExtractedCase } from '../ai/extraction.contracts';
import type { ProposalReclassifier } from '../proposal-classification/proposal-reclassifier';
import type { JobContext } from './extraction.types';
import { ExtractedProposalWriter } from './extracted-proposal-writer';

function extractedCase(overrides: Partial<ExtractedCase> = {}): ExtractedCase {
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

const connection = {
  provider: 'GITHUB' as const,
  repo: 'qably/qably',
  encryptedAccessToken: null as string | null,
};

function jobContext(overrides: Partial<JobContext> = {}): JobContext {
  return {
    projectId: 'project-1',
    organizationId: 'org-1',
    filePath: 'src/cart.spec.ts',
    ref: 'sha-1',
    connection,
    codeChangeId: null,
    targetTestCaseId: null,
    knownSuiteId: null,
    onlyAutomationKey: null,
    locale: undefined,
    isFinalAttempt: true,
    isFirstAttempt: true,
    ...overrides,
  };
}

interface FakePrisma {
  codeChange: { findUnique: jest.Mock };
  testCase: { findFirst: jest.Mock; findMany: jest.Mock };
  suite: { findFirst: jest.Mock };
  evidence: { create: jest.Mock; update: jest.Mock };
  extractedProposal: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
  $executeRawUnsafe: jest.Mock;
}

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    codeChange: {
      findUnique: jest.fn().mockResolvedValue({
        batchId: 'batch-1',
        commitSha: 'abc1234def',
        batch: { scmEvent: { author: 'ada', branch: 'main' } },
      }),
    },
    testCase: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    suite: {
      findFirst: jest.fn().mockResolvedValue(null),
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
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
  );

  return prisma;
}

function fakeEntitlement(
  spendCredit: jest.Mock = jest.fn().mockResolvedValue(true),
): AiEntitlementService {
  return { spendCredit } as unknown as AiEntitlementService;
}

function fakeReclassifier(
  enqueue: jest.Mock = jest.fn().mockResolvedValue(undefined),
): ProposalReclassifier {
  return { enqueue } as unknown as ProposalReclassifier;
}

function fakeEvents(publish: jest.Mock = jest.fn()): DomainEvents {
  return { publish } as unknown as DomainEvents;
}

function build(
  prisma: FakePrisma,
  entitlement: AiEntitlementService,
  reclassifier: ProposalReclassifier = fakeReclassifier(),
  events: DomainEvents = fakeEvents(),
) {
  return new ExtractedProposalWriter(
    prisma as never,
    entitlement,
    reclassifier,
    events,
  );
}

interface CallArgs {
  data?: Record<string, unknown>;
  where?: Record<string, unknown>;
}

function lastCall(mock: jest.Mock): CallArgs {
  const calls = mock.mock.calls as [CallArgs][];
  return calls[calls.length - 1][0];
}

describe('ExtractedProposalWriter.resolveSuiteId', () => {
  it('resolves via the automation file path when a case already carries it', async () => {
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValueOnce({
      suiteId: 'suite-by-path',
    });
    const writer = build(prisma, fakeEntitlement());

    const suiteId = await writer.resolveSuiteId(
      prisma as never,
      'project-1',
      'src/cart.spec.ts',
    );

    expect(suiteId).toBe('suite-by-path');
    expect(prisma.suite.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to a suite whose name matches the file path when no automation path matches', async () => {
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValueOnce(null);
    prisma.suite.findFirst.mockResolvedValueOnce({ id: 'suite-by-name' });
    const writer = build(prisma, fakeEntitlement());

    const suiteId = await writer.resolveSuiteId(
      prisma as never,
      'project-1',
      'src/cart.spec.ts',
    );

    expect(suiteId).toBe('suite-by-name');
  });

  it('falls back to the project default suite when neither the path nor the name matches', async () => {
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValueOnce(null);
    prisma.suite.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'suite-default' });
    const writer = build(prisma, fakeEntitlement());

    const suiteId = await writer.resolveSuiteId(
      prisma as never,
      'project-1',
      'src/cart.spec.ts',
    );

    expect(suiteId).toBe('suite-default');
  });

  it('returns null when the project has no default suite at all', async () => {
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValueOnce(null);
    prisma.suite.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const writer = build(prisma, fakeEntitlement());

    const suiteId = await writer.resolveSuiteId(
      prisma as never,
      'project-1',
      'src/cart.spec.ts',
    );

    expect(suiteId).toBeNull();
  });
});

describe('ExtractedProposalWriter.applyDecidedProposalGuard (via upsertCodeChangeProposal)', () => {
  it('skips updating an already-decided proposal instead of overwriting its decision', async () => {
    const prisma = createPrisma();
    const entitlement = fakeEntitlement();
    const writer = build(prisma, entitlement);

    await writer.applyDecidedProposalGuard(
      prisma as never,
      jobContext(),
      extractedCase(),
      { id: 'decided-1', status: 'approved', evidenceId: 'evidence-1' },
      null,
      'https://example.com/blob',
      {
        projectId: 'project-1',
        suiteId: null,
        status: 'in_review',
        title: 'Adds an item to the cart',
        objective: 'Verify the cart total updates',
        preconditions: [],
        steps: [],
        expectedResult: 'The total reflects the item price',
        priority: 'medium',
        promptVersion: 'v1',
      },
    );

    expect(prisma.evidence.update).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.update).not.toHaveBeenCalled();
  });

  it('updates the evidence and proposal fields when the existing proposal is still pending', async () => {
    const prisma = createPrisma();
    const entitlement = fakeEntitlement();
    const writer = build(prisma, entitlement);

    await writer.applyDecidedProposalGuard(
      prisma as never,
      jobContext(),
      extractedCase(),
      { id: 'pending-1', status: 'in_review', evidenceId: 'evidence-1' },
      'case-matched',
      'https://example.com/blob',
      {
        projectId: 'project-1',
        suiteId: null,
        status: 'in_review',
        title: 'Adds an item to the cart',
        objective: 'Verify the cart total updates',
        preconditions: [],
        steps: [],
        expectedResult: 'The total reflects the item price',
        priority: 'medium',
        promptVersion: 'v1',
      },
    );

    expect(lastCall(prisma.evidence.update).where).toEqual({
      id: 'evidence-1',
    });
    expect(lastCall(prisma.evidence.update).data?.title).toBe(
      'src/cart.spec.ts',
    );
    expect(lastCall(prisma.extractedProposal.update).where).toEqual({
      id: 'pending-1',
    });
    expect(
      lastCall(prisma.extractedProposal.update).data?.targetTestCaseId,
    ).toBe('case-matched');
  });
});

describe('ExtractedProposalWriter.upsertCodeChangeProposal — P2002 race', () => {
  it('resolves to the winning row when create races into a unique-constraint violation', async () => {
    const prisma = createPrisma();
    const p2002 = Object.assign(new Error('duplicate'), { code: 'P2002' });
    prisma.extractedProposal.create.mockRejectedValueOnce(p2002);
    prisma.extractedProposal.findFirst.mockResolvedValueOnce({
      id: 'winner-1',
      status: 'in_review',
      evidenceId: 'evidence-winner',
    });
    const writer = build(prisma, fakeEntitlement());

    await writer.upsertCodeChangeProposal(
      prisma as never,
      jobContext({ codeChangeId: 'change-1' }),
      extractedCase(),
      null,
      null,
      'https://example.com/blob',
      {
        projectId: 'project-1',
        suiteId: null,
        status: 'in_review',
        title: 'Adds an item to the cart',
        objective: 'Verify the cart total updates',
        preconditions: [],
        steps: [],
        expectedResult: 'The total reflects the item price',
        priority: 'medium',
        promptVersion: 'v1',
      },
    );

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('ROLLBACK TO SAVEPOINT'),
    );
    expect(lastCall(prisma.extractedProposal.update).where).toEqual({
      id: 'winner-1',
    });
    expect(
      lastCall(prisma.extractedProposal.update).data?.targetTestCaseId,
    ).toBeNull();
  });

  it('rethrows an error that is not a unique-constraint violation', async () => {
    const prisma = createPrisma();
    const otherError = new Error('connection reset');
    prisma.extractedProposal.create.mockRejectedValueOnce(otherError);
    const writer = build(prisma, fakeEntitlement());

    await expect(
      writer.upsertCodeChangeProposal(
        prisma as never,
        jobContext({ codeChangeId: 'change-1' }),
        extractedCase(),
        null,
        null,
        'https://example.com/blob',
        {
          projectId: 'project-1',
          suiteId: null,
          status: 'in_review',
          title: 'Adds an item to the cart',
          objective: 'Verify the cart total updates',
          preconditions: [],
          steps: [],
          expectedResult: 'The total reflects the item price',
          priority: 'medium',
          promptVersion: 'v1',
        },
      ),
    ).rejects.toThrow('connection reset');
  });
});

describe('ExtractedProposalWriter.persistExtracted — pending non-manual proposal short-circuit', () => {
  it('does nothing further when a non-manual proposal is already pending for the target case', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValueOnce({
      id: 'existing-pending',
    });
    const entitlement = fakeEntitlement();
    const writer = build(prisma, entitlement);

    const persisted = await writer.persistExtracted(
      [extractedCase()],
      jobContext({ targetTestCaseId: 'case-1' }),
    );

    expect(persisted).toBe(true);
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.evidence.create).not.toHaveBeenCalled();
  });

  it('creates a new proposal when no proposal is pending for the target case', async () => {
    const prisma = createPrisma();
    const entitlement = fakeEntitlement();
    const writer = build(prisma, entitlement);

    const persisted = await writer.persistExtracted(
      [extractedCase()],
      jobContext({ targetTestCaseId: 'case-1' }),
    );

    expect(persisted).toBe(true);
    expect(prisma.evidence.create).toHaveBeenCalledTimes(1);
    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
  });
});

describe('ExtractedProposalWriter.persistExtracted — reclassify trigger', () => {
  it('enqueues a reclassify job for the resolved suite once persisting succeeds', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'suite-resolved' });
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const writer = build(prisma, fakeEntitlement(), fakeReclassifier(enqueue));

    await writer.persistExtracted([extractedCase()], jobContext());

    expect(enqueue).toHaveBeenCalledWith('suite-resolved');
  });

  it('uses knownSuiteId directly, skipping suite resolution, when the caller already knows it', async () => {
    const prisma = createPrisma();
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const writer = build(prisma, fakeEntitlement(), fakeReclassifier(enqueue));

    await writer.persistExtracted(
      [extractedCase()],
      jobContext({ knownSuiteId: 'suite-known' }),
    );

    expect(prisma.suite.findFirst).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith('suite-known');
  });

  it('passes null through to the reclassifier when no suite could be resolved', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const writer = build(prisma, fakeEntitlement(), fakeReclassifier(enqueue));

    await writer.persistExtracted([extractedCase()], jobContext());

    expect(enqueue).toHaveBeenCalledWith(null);
  });

  it('enqueues the reclassify job once per call, not once per extracted case', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'suite-resolved' });
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const writer = build(prisma, fakeEntitlement(), fakeReclassifier(enqueue));

    await writer.persistExtracted(
      [
        extractedCase(),
        extractedCase({ automationKey: 'Cart > removes an item' }),
      ],
      jobContext(),
    );

    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('never enqueues a reclassify job when the entitlement credit spend is rejected', async () => {
    const prisma = createPrisma();
    const entitlement = fakeEntitlement(jest.fn().mockResolvedValue(false));
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const writer = build(prisma, entitlement, fakeReclassifier(enqueue));

    const persisted = await writer.persistExtracted(
      [extractedCase()],
      jobContext(),
    );

    expect(persisted).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('ExtractedProposalWriter.persistExtracted — proposals created event', () => {
  const pushContext = () => jobContext({ codeChangeId: 'change-1' });

  it('announces a push batch once, with the number of proposals the job created', async () => {
    const prisma = createPrisma();
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted(
      [
        extractedCase(),
        extractedCase({ automationKey: 'Cart > removes an item' }),
      ],
      pushContext(),
    );

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(DOMAIN_EVENTS.proposalsCreated, {
      source: 'push',
      organizationId: 'org-1',
      projectId: 'project-1',
      batchId: 'batch-1',
      count: 2,
      commitSha: 'abc1234def',
      author: 'ada',
      branch: 'main',
    });
    expect(prisma.codeChange.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'change-1' } }),
    );
  });

  it('publishes only after the transaction has committed, never inside it', async () => {
    const prisma = createPrisma();
    let committed = false;
    prisma.$transaction.mockImplementation(
      async (run: (tx: FakePrisma) => unknown) => {
        const result = await run(prisma);
        committed = true;
        return result;
      },
    );
    const publish = jest.fn(() => {
      expect(committed).toBe(true);
    });
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted([extractedCase()], pushContext());

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('counts only the proposals it created, not the pending ones a redelivery refreshed', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      {
        id: 'pending-1',
        status: 'in_review',
        evidenceId: 'evidence-1',
        automationKey: 'Cart > adds an item',
      },
    ]);
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted(
      [
        extractedCase(),
        extractedCase({ automationKey: 'Cart > removes an item' }),
      ],
      pushContext(),
    );

    expect(publish).toHaveBeenCalledWith(
      DOMAIN_EVENTS.proposalsCreated,
      expect.objectContaining({ count: 1 }),
    );
  });

  it('publishes nothing when the job only refreshed or skipped existing proposals', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      {
        id: 'pending-1',
        status: 'in_review',
        evidenceId: 'evidence-1',
        automationKey: 'Cart > adds an item',
      },
      {
        id: 'decided-1',
        status: 'approved',
        evidenceId: 'evidence-2',
        automationKey: 'Cart > removes an item',
      },
    ]);
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    const persisted = await writer.persistExtracted(
      [
        extractedCase(),
        extractedCase({ automationKey: 'Cart > removes an item' }),
      ],
      pushContext(),
    );

    expect(persisted).toBe(true);
    expect(publish).not.toHaveBeenCalled();
    expect(prisma.codeChange.findUnique).not.toHaveBeenCalled();
  });

  it('publishes nothing when the create lost a race to another job', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.create.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 'P2002' }),
    );
    prisma.extractedProposal.findFirst.mockResolvedValueOnce({
      id: 'winner-1',
      status: 'in_review',
      evidenceId: 'evidence-winner',
    });
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted([extractedCase()], pushContext());

    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes nothing when a proposal is already pending for the target case', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValueOnce({
      id: 'existing-pending',
    });
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted(
      [extractedCase()],
      jobContext({ targetTestCaseId: 'case-1' }),
    );

    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes nothing when the entitlement credit spend is rejected', async () => {
    const prisma = createPrisma();
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(jest.fn().mockResolvedValue(false)),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted([extractedCase()], pushContext());

    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes nothing when the transaction throws', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.create.mockRejectedValueOnce(
      new Error('connection reset'),
    );
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await expect(
      writer.persistExtracted([extractedCase()], pushContext()),
    ).rejects.toThrow('connection reset');

    expect(publish).not.toHaveBeenCalled();
  });

  it('leaves out the SCM details when the push event is no longer on record', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockResolvedValue({
      batchId: 'batch-1',
      commitSha: '',
      batch: { scmEvent: null },
    });
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted([extractedCase()], pushContext());

    expect(publish).toHaveBeenCalledWith(DOMAIN_EVENTS.proposalsCreated, {
      source: 'push',
      organizationId: 'org-1',
      projectId: 'project-1',
      batchId: 'batch-1',
      count: 1,
    });
  });

  it('keeps the job successful when the batch lookup fails after the commit', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockRejectedValue(new Error('db gone'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await expect(
      writer.persistExtracted([extractedCase()], pushContext()),
    ).resolves.toBe(true);

    expect(publish).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db gone'));
    warn.mockRestore();
  });

  it('keeps the job successful when the code change disappeared after the commit', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockResolvedValue(null);
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await expect(
      writer.persistExtracted([extractedCase()], pushContext()),
    ).resolves.toBe(true);

    expect(publish).not.toHaveBeenCalled();
  });

  it('announces a documented case by its proposal id, since a documentation request creates a single proposal', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.create.mockResolvedValue({ id: 'proposal-77' });
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted(
      [extractedCase()],
      jobContext({ targetTestCaseId: 'case-1' }),
    );

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(DOMAIN_EVENTS.proposalsCreated, {
      source: 'documentation',
      organizationId: 'org-1',
      projectId: 'project-1',
      batchId: 'proposal-77',
      count: 1,
    });
    expect(prisma.codeChange.findUnique).not.toHaveBeenCalled();
  });

  it('announces each proposal of a single-proposal source on its own, so every batch id matches one inbox row', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.create
      .mockResolvedValueOnce({ id: 'proposal-a' })
      .mockResolvedValueOnce({ id: 'proposal-b' });
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted(
      [
        extractedCase(),
        extractedCase({ automationKey: 'Cart > removes an item' }),
      ],
      jobContext(),
    );

    const batches = publish.mock.calls.map(
      ([, event]: [string, { batchId: string }]) => event.batchId,
    );
    expect(batches).toEqual(['proposal-a', 'proposal-b']);
  });
});

describe('ExtractedProposalWriter.persistExtracted — one open proposal per test case across pushes', () => {
  interface FindManyArgs {
    where?: Record<string, unknown>;
    orderBy?: unknown;
  }

  interface StoredProposal {
    id: string;
    status: string;
    evidenceId: string;
    automationKey: string;
  }

  const secondPush = (overrides: Partial<JobContext> = {}) =>
    jobContext({ codeChangeId: 'change-2', ...overrides });

  function storedProposal(
    overrides: Partial<StoredProposal> = {},
  ): StoredProposal {
    return {
      id: 'older-1',
      status: 'in_review',
      evidenceId: 'evidence-older',
      automationKey: 'Cart > adds an item',
      ...overrides,
    };
  }

  // The writer reads proposals twice: the ones this code change already owns
  // (`codeChangeId` is a plain id) and the open ones of earlier pushes
  // (`codeChangeId` is a `not` filter). Each lookup gets its own answer.
  function stubLookups(
    prisma: FakePrisma,
    rows: { sameChange?: StoredProposal[]; earlier?: StoredProposal[] },
  ): void {
    prisma.extractedProposal.findMany.mockImplementation((args: FindManyArgs) =>
      Promise.resolve(
        typeof args.where?.codeChangeId === 'string'
          ? (rows.sameChange ?? [])
          : (rows.earlier ?? []),
      ),
    );
  }

  function earlierLookup(prisma: FakePrisma): FindManyArgs {
    const calls = prisma.extractedProposal.findMany.mock.calls as [
      FindManyArgs,
    ][];
    const match = calls.find(
      ([args]) => typeof args.where?.codeChangeId === 'object',
    );
    if (match === undefined) throw new Error('no earlier-push lookup was made');
    return match[0];
  }

  function advisoryLocks(prisma: FakePrisma): string[] {
    const calls = prisma.$executeRawUnsafe.mock.calls as [string, string][];
    return calls
      .filter(([sql]) => sql.includes('pg_advisory_xact_lock'))
      .map(([, lockKey]) => lockKey);
  }

  const lockKeyOf = (automationKey: string) =>
    JSON.stringify(['project-1', 'src/cart.spec.ts', automationKey]);

  it('refreshes the open proposal of an earlier push instead of creating a second one', async () => {
    const prisma = createPrisma();
    stubLookups(prisma, { earlier: [storedProposal()] });
    const writer = build(prisma, fakeEntitlement());

    const persisted = await writer.persistExtracted(
      [extractedCase({ title: 'Adds an item, reworded' })],
      secondPush(),
    );

    expect(persisted).toBe(true);
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.evidence.create).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.update).toHaveBeenCalledTimes(1);
    expect(lastCall(prisma.extractedProposal.update).where).toEqual({
      id: 'older-1',
    });
    expect(lastCall(prisma.extractedProposal.update).data).toMatchObject({
      title: 'Adds an item, reworded',
      status: 'in_review',
      targetTestCaseId: null,
    });
    expect(lastCall(prisma.evidence.update).where).toEqual({
      id: 'evidence-older',
    });
    expect(lastCall(prisma.evidence.update).data).toEqual({
      title: 'src/cart.spec.ts',
      uri: 'https://github.com/qably/qably/blob/sha-1/src/cart.spec.ts',
      excerpt: "it('adds an item', () => {})",
    });
  });

  it('moves the refreshed proposal to the current code change so the newest push owns it', async () => {
    const prisma = createPrisma();
    stubLookups(prisma, { earlier: [storedProposal()] });
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted([extractedCase()], secondPush());

    expect(lastCall(prisma.extractedProposal.update).data).toMatchObject({
      codeChangeId: 'change-2',
    });
  });

  it('points the refreshed proposal at the catalog case the key now matches', async () => {
    const prisma = createPrisma();
    stubLookups(prisma, { earlier: [storedProposal()] });
    prisma.testCase.findMany.mockResolvedValue([
      { id: 'case-existing', automationKey: 'Cart > adds an item' },
    ]);
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted(
      [extractedCase()],
      secondPush({ knownSuiteId: 'suite-1' }),
    );

    expect(lastCall(prisma.extractedProposal.update).data).toMatchObject({
      suiteId: 'suite-1',
      targetTestCaseId: 'case-existing',
    });
  });

  it('looks for the earlier proposal by project, key and source file, among those still in review, newest first', async () => {
    const prisma = createPrisma();
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted(
      [
        extractedCase(),
        extractedCase({ automationKey: 'Cart > removes an item' }),
      ],
      secondPush(),
    );

    expect(earlierLookup(prisma)).toMatchObject({
      where: {
        projectId: 'project-1',
        automationKey: {
          in: ['Cart > adds an item', 'Cart > removes an item'],
        },
        status: 'in_review',
        codeChangeId: { not: 'change-2' },
        codeChange: { filePath: 'src/cart.spec.ts' },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('creates a new proposal when the same key only exists in another file', async () => {
    const prisma = createPrisma();
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted(
      [extractedCase()],
      secondPush({ filePath: 'src/other.spec.ts' }),
    );

    expect(earlierLookup(prisma).where).toMatchObject({
      codeChange: { filePath: 'src/other.spec.ts' },
    });
    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
    expect(prisma.extractedProposal.update).not.toHaveBeenCalled();
  });

  it('refreshes only the newest proposal when duplicates are open, leaving the others untouched', async () => {
    const prisma = createPrisma();
    stubLookups(prisma, {
      earlier: [
        storedProposal({ id: 'newest', evidenceId: 'evidence-newest' }),
        storedProposal({ id: 'older', evidenceId: 'evidence-older' }),
        storedProposal({ id: 'oldest', evidenceId: 'evidence-oldest' }),
      ],
    });
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted([extractedCase()], secondPush());

    expect(prisma.extractedProposal.update).toHaveBeenCalledTimes(1);
    expect(lastCall(prisma.extractedProposal.update).where).toEqual({
      id: 'newest',
    });
    expect(prisma.evidence.update).toHaveBeenCalledTimes(1);
    expect(lastCall(prisma.evidence.update).where).toEqual({
      id: 'evidence-newest',
    });
    expect(prisma.extractedProposal.deleteMany).not.toHaveBeenCalled();
  });

  it('does not announce a push whose proposals were all refreshed', async () => {
    const prisma = createPrisma();
    stubLookups(prisma, { earlier: [storedProposal()] });
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    const persisted = await writer.persistExtracted(
      [extractedCase()],
      secondPush(),
    );

    expect(persisted).toBe(true);
    expect(publish).not.toHaveBeenCalled();
    expect(prisma.codeChange.findUnique).not.toHaveBeenCalled();
  });

  it('announces only the proposals it created when a push mixes new and refreshed cases', async () => {
    const prisma = createPrisma();
    stubLookups(prisma, { earlier: [storedProposal()] });
    const publish = jest.fn();
    const writer = build(
      prisma,
      fakeEntitlement(),
      fakeReclassifier(),
      fakeEvents(publish),
    );

    await writer.persistExtracted(
      [
        extractedCase(),
        extractedCase({ automationKey: 'Cart > removes an item' }),
      ],
      secondPush(),
    );

    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      DOMAIN_EVENTS.proposalsCreated,
      expect.objectContaining({ batchId: 'batch-1', count: 1 }),
    );
  });

  it('leaves the decided proposals of earlier pushes out of the lookup and opens a new one', async () => {
    const prisma = createPrisma();
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted([extractedCase()], secondPush());

    expect(earlierLookup(prisma).where).toMatchObject({ status: 'in_review' });
    expect(prisma.extractedProposal.create).toHaveBeenCalledTimes(1);
    expect(prisma.extractedProposal.update).not.toHaveBeenCalled();
  });

  it('keeps refreshing the proposal of the same push in place on a redelivery, without moving it', async () => {
    const prisma = createPrisma();
    stubLookups(prisma, {
      sameChange: [storedProposal({ id: 'same-push' })],
      earlier: [storedProposal({ id: 'earlier-push' })],
    });
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted([extractedCase()], secondPush());

    expect(prisma.extractedProposal.update).toHaveBeenCalledTimes(1);
    expect(lastCall(prisma.extractedProposal.update).where).toEqual({
      id: 'same-push',
    });
    expect(lastCall(prisma.extractedProposal.update).data).not.toHaveProperty(
      'codeChangeId',
    );
  });

  it('leaves everything alone when the same push already has the proposal decided', async () => {
    const prisma = createPrisma();
    stubLookups(prisma, {
      sameChange: [storedProposal({ id: 'decided', status: 'approved' })],
      earlier: [storedProposal({ id: 'earlier-push' })],
    });
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted([extractedCase()], secondPush());

    expect(prisma.extractedProposal.update).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('takes one advisory lock per case, in sorted order, before reading any proposal', async () => {
    const prisma = createPrisma();
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted(
      [
        extractedCase({ automationKey: 'Cart > b' }),
        extractedCase({ automationKey: 'Cart > a' }),
        extractedCase({ automationKey: 'Cart > c' }),
      ],
      secondPush(),
    );

    expect(advisoryLocks(prisma)).toEqual([
      lockKeyOf('Cart > a'),
      lockKeyOf('Cart > b'),
      lockKeyOf('Cart > c'),
    ]);

    const lockOrders = prisma.$executeRawUnsafe.mock.invocationCallOrder.slice(
      0,
      3,
    );
    const firstRead = Math.min(
      ...prisma.extractedProposal.findMany.mock.invocationCallOrder,
    );
    for (const order of lockOrders) expect(order).toBeLessThan(firstRead);
  });

  it('hashes the lock key to 64 bits inside the database and parametrizes it', async () => {
    const prisma = createPrisma();
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted([extractedCase()], secondPush());

    const [sql, lockKey] = prisma.$executeRawUnsafe.mock.calls[0] as [
      string,
      string,
    ];
    expect(sql).toBe(
      'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
    );
    expect(lockKey).toBe(lockKeyOf('Cart > adds an item'));
  });

  it('takes a lock once for a key the model repeated', async () => {
    const prisma = createPrisma();
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted(
      [extractedCase(), extractedCase()],
      secondPush(),
    );

    expect(advisoryLocks(prisma)).toEqual([lockKeyOf('Cart > adds an item')]);
  });

  it('scopes the lock to the file, so the same key in two files never waits', async () => {
    const prisma = createPrisma();
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted(
      [extractedCase()],
      secondPush({ filePath: 'src/other.spec.ts' }),
    );

    expect(advisoryLocks(prisma)).toEqual([
      JSON.stringify(['project-1', 'src/other.spec.ts', 'Cart > adds an item']),
    ]);
  });

  it('takes no lock and makes no cross-push lookup for sources that are not a push', async () => {
    const prisma = createPrisma();
    const writer = build(prisma, fakeEntitlement());

    await writer.persistExtracted(
      [extractedCase()],
      jobContext({ targetTestCaseId: 'case-1' }),
    );

    expect(advisoryLocks(prisma)).toEqual([]);
    expect(prisma.extractedProposal.findMany).not.toHaveBeenCalled();
  });

  it('takes no lock when the credit spend is rejected', async () => {
    const prisma = createPrisma();
    const writer = build(
      prisma,
      fakeEntitlement(jest.fn().mockResolvedValue(false)),
    );

    await writer.persistExtracted([extractedCase()], secondPush());

    expect(advisoryLocks(prisma)).toEqual([]);
  });
});
