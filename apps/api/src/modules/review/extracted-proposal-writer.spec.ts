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

function build(
  prisma: FakePrisma,
  entitlement: AiEntitlementService,
  reclassifier: ProposalReclassifier = fakeReclassifier(),
) {
  return new ExtractedProposalWriter(
    prisma as never,
    entitlement,
    reclassifier,
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
