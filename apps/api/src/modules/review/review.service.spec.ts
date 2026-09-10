import type { OrgContext } from '../organizations/organizations.contracts';
import { ReviewService } from './review.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

type FixtureStatus = 'in_review' | 'approved' | 'rejected';

const proposalRow = {
  id: 'proposal-1',
  projectId: 'project-1',
  status: 'in_review' as FixtureStatus,
  title: 'Empties the cart',
  objective: 'Confirm the cart resets',
  preconditions: ['A signed-in user'],
  steps: ['Open the cart', 'Remove every item'],
  expectedResult: 'The cart shows zero items',
  priority: 'high' as const,
  evidenceId: 'evidence-1',
  targetTestCaseId: null as string | null,
  evidence: { id: 'evidence-1' } as { id: string } | null,
  suiteId: null as string | null,
  automationKey: null as string | null,
  codeChange: null as { filePath: string } | null,
  targetTestCase: null as { automationFilePath: string | null } | null,
  needsManualReview: false,
};

interface FakePrisma {
  extractedProposal: { findFirst: jest.Mock; update: jest.Mock };
  suiteProposal: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  suite: { findFirst: jest.Mock; update: jest.Mock };
  testCase: { create: jest.Mock; update: jest.Mock };
  testCaseVersion: { count: jest.Mock; create: jest.Mock };
  reviewDecision: { create: jest.Mock };
  traceabilityLink: { createMany: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
}

function createPrisma(overrides: Partial<typeof proposalRow> = {}): FakePrisma {
  const prisma: FakePrisma = {
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue({ ...proposalRow, ...overrides }),
      update: jest.fn().mockResolvedValue({ id: 'proposal-1' }),
    },
    suiteProposal: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'suite-proposal-1' }),
    },
    suite: {
      findFirst: jest.fn().mockResolvedValue({ id: 'suite-1' }),
      update: jest.fn().mockResolvedValue({ name: 'Carrito de compras' }),
    },
    testCase: {
      create: jest.fn().mockResolvedValue({ id: 'case-new' }),
      update: jest.fn().mockResolvedValue({ id: 'case-new' }),
    },
    testCaseVersion: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'version-1', version: 1 }),
    },
    reviewDecision: {
      create: jest.fn().mockResolvedValue({ id: 'decision-1' }),
    },
    traceabilityLink: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
  );

  return prisma;
}

function build(prisma: FakePrisma) {
  return new ReviewService(prisma as never);
}

describe('ReviewService.approve', () => {
  it('creates an official case and its first version when the proposal has no target', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        createdNewCase: true,
        testCaseId: 'case-new',
        testCaseName: 'Empties the cart',
        suiteId: 'suite-1',
        versionId: 'version-1',
        version: 1,
        decisionId: 'decision-1',
      },
    });
    const [call] = prisma.testCase.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toMatchObject({
      projectId: 'project-1',
      suiteId: 'suite-1',
      name: 'Empties the cart',
      state: 'active',
    });
  });

  it('uses the proposal suiteId instead of the default suite when it carries one', async () => {
    const prisma = createPrisma({ suiteId: 'suite-from-extraction' });

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    expect(prisma.suite.findFirst).not.toHaveBeenCalled();
    const [call] = prisma.testCase.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toMatchObject({ suiteId: 'suite-from-extraction' });
  });

  it('marks a new case automated with its automationKey and the code change file path', async () => {
    const prisma = createPrisma({
      automationKey: 'Cart > adds an item',
      codeChange: { filePath: 'src/cart.spec.ts' },
    });

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    const [call] = prisma.testCase.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toMatchObject({
      executionMode: 'automated',
      automationKey: 'Cart > adds an item',
      automationFilePath: 'src/cart.spec.ts',
    });
  });

  it('never marks the case automated when the proposal has no automationKey', async () => {
    const prisma = createPrisma();

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    const [call] = prisma.testCase.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).not.toHaveProperty('executionMode');
    expect(call[0].data).not.toHaveProperty('automationKey');
  });

  it('snapshots the proposal fields into the published version', async () => {
    const prisma = createPrisma();

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    const [call] = prisma.testCaseVersion.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toMatchObject({
      testCaseId: 'case-new',
      version: 1,
      title: 'Empties the cart',
      objective: 'Confirm the cart resets',
      preconditions: ['A signed-in user'],
      steps: ['Open the cart', 'Remove every item'],
      expectedResult: 'The cart shows zero items',
      priority: 'high',
    });
  });

  it('publishes the next version against the targeted case instead of creating one', async () => {
    const prisma = createPrisma({ targetTestCaseId: 'case-existing' });
    prisma.testCaseVersion.count.mockResolvedValue(2);
    prisma.testCaseVersion.create.mockResolvedValue({
      id: 'version-3',
      version: 3,
    });

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        createdNewCase: false,
        testCaseId: 'case-existing',
        testCaseName: 'Empties the cart',
        suiteId: null,
        versionId: 'version-3',
        version: 3,
        decisionId: 'decision-1',
      },
    });
    expect(prisma.testCase.create).not.toHaveBeenCalled();
  });

  it('reports the case suite id when the proposal already carries the target case suite', async () => {
    const prisma = createPrisma({
      targetTestCaseId: 'case-existing',
      suiteId: 'suite-of-existing-case',
    });
    prisma.testCaseVersion.count.mockResolvedValue(2);
    prisma.testCaseVersion.create.mockResolvedValue({
      id: 'version-3',
      version: 3,
    });

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result.ok && result.value.suiteId).toBe('suite-of-existing-case');
  });

  it('points the official case at the version it just published', async () => {
    const prisma = createPrisma();

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-new' },
      data: {
        currentVersionId: 'version-1',
        name: 'Empties the cart',
        steps: ['Open the cart', 'Remove every item'],
        expectedResult: 'The cart shows zero items',
        priority: 'high',
        state: 'active',
      },
    });
  });

  it('refreshes the official case content when publishing over an existing case', async () => {
    const prisma = createPrisma({
      targetTestCaseId: 'case-existing',
      title: 'Empties the cart from the mini basket',
      steps: ['Open the mini basket', 'Remove every item'],
      expectedResult: 'The mini basket shows zero items',
    });
    prisma.testCaseVersion.count.mockResolvedValue(1);
    prisma.testCaseVersion.create.mockResolvedValue({
      id: 'version-2',
      version: 2,
    });

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-existing' },
      data: {
        currentVersionId: 'version-2',
        name: 'Empties the cart from the mini basket',
        steps: ['Open the mini basket', 'Remove every item'],
        expectedResult: 'The mini basket shows zero items',
        priority: 'high',
        state: 'active',
      },
    });
  });

  it('marks the targeted case automated using its own automationFilePath when documenting it', async () => {
    const prisma = createPrisma({
      targetTestCaseId: 'case-existing',
      automationKey: 'Cart > adds an item',
      targetTestCase: { automationFilePath: 'src/cart.spec.ts' },
    });
    prisma.testCaseVersion.count.mockResolvedValue(1);
    prisma.testCaseVersion.create.mockResolvedValue({
      id: 'version-2',
      version: 2,
    });

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-existing' },
      data: {
        currentVersionId: 'version-2',
        name: 'Empties the cart',
        steps: ['Open the cart', 'Remove every item'],
        expectedResult: 'The cart shows zero items',
        priority: 'high',
        state: 'active',
        executionMode: 'automated',
        automationKey: 'Cart > adds an item',
        automationFilePath: 'src/cart.spec.ts',
      },
    });
  });

  it('records the produced and version_of traceability links', async () => {
    const prisma = createPrisma();

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    expect(prisma.traceabilityLink.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          {
            projectId: 'project-1',
            fromType: 'proposal',
            fromId: 'proposal-1',
            toType: 'test_case',
            toId: 'case-new',
            relation: 'produced',
          },
          {
            projectId: 'project-1',
            fromType: 'test_case_version',
            fromId: 'version-1',
            toType: 'test_case',
            toId: 'case-new',
            relation: 'version_of',
          },
        ],
        skipDuplicates: true,
      }),
    );
  });

  it('returns not-found when the proposal is outside the organization', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue(null);

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns invalid-transition when the proposal is already decided', async () => {
    const prisma = createPrisma({ status: 'approved' });

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'invalid-transition' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns missing-evidence when the linked evidence is gone', async () => {
    const prisma = createPrisma({ evidence: null });

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'missing-evidence' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to publish a proposal that documents no steps', async () => {
    const prisma = createPrisma({ steps: [], needsManualReview: true });

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'incomplete-proposal' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.testCase.create).not.toHaveBeenCalled();
  });

  it('returns missing-suite when the project has no suite to publish into', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'missing-suite' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns name-taken when the title collides with another case in the suite', async () => {
    const prisma = createPrisma();
    prisma.testCase.create.mockRejectedValue({ code: 'P2002' });

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'name-taken' });
  });

  it('returns name-taken when refreshing an existing case collides', async () => {
    const prisma = createPrisma({ targetTestCaseId: 'case-existing' });
    prisma.testCase.update.mockRejectedValue({ code: 'P2002' });

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'name-taken' });
    expect(prisma.extractedProposal.update).not.toHaveBeenCalled();
  });

  it('never swallows a failure that is not a unique violation', async () => {
    const prisma = createPrisma();
    prisma.testCase.create.mockRejectedValue(new Error('connection lost'));

    await expect(
      build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' }),
    ).rejects.toThrow('connection lost');
  });

  it('never flips the proposal status when publishing the version fails', async () => {
    const prisma = createPrisma();
    prisma.testCaseVersion.create.mockRejectedValue(new Error('insert failed'));

    await expect(
      build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' }),
    ).rejects.toThrow('insert failed');

    expect(prisma.extractedProposal.update).not.toHaveBeenCalled();
    expect(prisma.reviewDecision.create).not.toHaveBeenCalled();
  });
});

describe('ReviewService.reject', () => {
  it('records the decision and moves the proposal to rejected', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).reject(org, 'proposal-1', {
      actorId: 'user-1',
      comment: 'Evidence does not support the steps',
    });

    expect(result).toEqual({ ok: true, value: { decisionId: 'decision-1' } });
    const [call] = prisma.reviewDecision.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toMatchObject({
      proposalId: 'proposal-1',
      actorId: 'user-1',
      action: 'rejected',
      comment: 'Evidence does not support the steps',
    });
    expect(prisma.extractedProposal.update).toHaveBeenCalledWith({
      where: { id: 'proposal-1' },
      data: { status: 'rejected' },
    });
  });

  it('still rejects a proposal that documents no steps', async () => {
    const prisma = createPrisma({ steps: [], needsManualReview: true });

    const result = await build(prisma).reject(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: true, value: { decisionId: 'decision-1' } });
  });

  it('does not publish an official case when rejecting', async () => {
    const prisma = createPrisma();

    await build(prisma).reject(org, 'proposal-1', { actorId: 'user-1' });

    expect(prisma.testCase.create).not.toHaveBeenCalled();
    expect(prisma.testCaseVersion.create).not.toHaveBeenCalled();
  });

  it('returns invalid-transition when the proposal is already decided', async () => {
    const prisma = createPrisma({ status: 'rejected' });

    const result = await build(prisma).reject(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'invalid-transition' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('ReviewService.approveMany', () => {
  function createBulkPrisma(
    rowsById: Record<string, typeof proposalRow | undefined>,
  ) {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve(rowsById[args.where.id] ?? null),
    );
    return prisma;
  }

  it('returns a per-item outcome, skipping an id that no longer exists', async () => {
    const prisma = createBulkPrisma({
      'proposal-1': proposalRow,
    });

    const results = await build(prisma).approveMany(
      org,
      ['proposal-1', 'proposal-missing'],
      {
        actorId: 'user-1',
      },
    );

    expect(results).toEqual([
      expect.objectContaining({ id: 'proposal-1', outcome: 'approved' }),
      expect.objectContaining({
        id: 'proposal-missing',
        outcome: 'skipped',
        reason: 'not-found',
      }),
    ]);
  });

  it('reports the guard reason for a proposal that was already decided', async () => {
    const prisma = createBulkPrisma({
      'proposal-1': { ...proposalRow, status: 'approved' },
    });

    const results = await build(prisma).approveMany(org, ['proposal-1'], {
      actorId: 'user-1',
    });

    expect(results).toEqual([
      { id: 'proposal-1', outcome: 'skipped', reason: 'invalid-transition' },
    ]);
  });

  it('deduplicates repeated ids server-side', async () => {
    const prisma = createBulkPrisma({ 'proposal-1': proposalRow });

    const results = await build(prisma).approveMany(
      org,
      ['proposal-1', 'proposal-1'],
      { actorId: 'user-1' },
    );

    expect(results).toHaveLength(1);
    expect(prisma.testCase.create).toHaveBeenCalledTimes(1);
  });
});

describe('ReviewService.rejectMany', () => {
  function createBulkPrisma(
    rowsById: Record<string, typeof proposalRow | undefined>,
  ) {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve(rowsById[args.where.id] ?? null),
    );
    return prisma;
  }

  it('rejects every valid id and skips the rest with a reason', async () => {
    const prisma = createBulkPrisma({
      'proposal-1': proposalRow,
      'proposal-2': { ...proposalRow, status: 'rejected' },
    });

    const results = await build(prisma).rejectMany(
      org,
      ['proposal-1', 'proposal-2'],
      {
        actorId: 'user-1',
      },
    );

    expect(results).toEqual([
      { id: 'proposal-1', outcome: 'rejected' },
      { id: 'proposal-2', outcome: 'skipped', reason: 'invalid-transition' },
    ]);
  });
});

describe('ReviewService.findOne', () => {
  it('tells the reviewer when a proposal was flagged for manual review', async () => {
    const prisma = createPrisma({
      steps: [],
      expectedResult: '',
      objective: 'extraction-failed',
      needsManualReview: true,
      evidence: null,
    });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.needsManualReview).toBe(true);
      expect(result.value.steps).toEqual([]);
    }
  });

  it('reports an ordinary proposal as not needing manual review', async () => {
    const prisma = createPrisma({ evidence: null });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.needsManualReview).toBe(false);
  });
});

describe('ReviewService suite proposals', () => {
  const suiteProposalRow = {
    id: 'suite-proposal-1',
    projectId: 'project-1',
    suiteId: 'suite-1',
    title: 'Carrito de compras',
    description: 'Cubre agregar y quitar artículos',
    status: 'in_review' as FixtureStatus,
    evidenceId: 'evidence-9',
    createdAt: new Date('2026-09-09T10:00:00.000Z'),
    decidedAt: null as Date | null,
    suite: { name: 'cart.spec.ts', nameSource: 'ingestion' },
  };

  it('lists suite proposals of the organization with the current suite name and its source', async () => {
    const prisma = createPrisma();
    prisma.suiteProposal.findMany.mockResolvedValue([suiteProposalRow]);

    const items = await build(prisma).listSuiteProposals(org, {
      projectId: 'project-1',
    });

    expect(items).toEqual([
      expect.objectContaining({
        id: 'suite-proposal-1',
        suiteName: 'cart.spec.ts',
        suiteNameSource: 'ingestion',
        title: 'Carrito de compras',
        status: 'in_review',
        createdAt: '2026-09-09T10:00:00.000Z',
        decidedAt: null,
      }),
    ]);
    expect(prisma.suiteProposal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: { organizationId: 'org-1' },
          projectId: 'project-1',
        }) as unknown,
      }),
    );
  });

  it('approving renames and describes a suite whose name still came from ingestion', async () => {
    const prisma = createPrisma();
    prisma.suiteProposal.findFirst.mockResolvedValue(suiteProposalRow);

    const result = await build(prisma).approveSuiteProposal(
      org,
      'suite-proposal-1',
    );

    expect(result).toEqual({
      ok: true,
      value: {
        proposalId: 'suite-proposal-1',
        applied: true,
        suiteId: 'suite-1',
        suiteName: 'Carrito de compras',
      },
    });
    expect(prisma.suite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'suite-1' },
        data: {
          name: 'Carrito de compras',
          description: 'Cubre agregar y quitar artículos',
          nameSource: 'aeris',
        },
      }),
    );
    expect(prisma.suiteProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'suite-proposal-1' },
        data: expect.objectContaining({ status: 'approved' }) as unknown,
      }),
    );
  });

  it('approving a proposal for a suite a person renamed records the decision but touches nothing', async () => {
    const prisma = createPrisma();
    prisma.suiteProposal.findFirst.mockResolvedValue({
      ...suiteProposalRow,
      suite: { name: 'Checkout', nameSource: 'human' },
    });

    const result = await build(prisma).approveSuiteProposal(
      org,
      'suite-proposal-1',
    );

    expect(result).toEqual({
      ok: true,
      value: {
        proposalId: 'suite-proposal-1',
        applied: false,
        suiteId: 'suite-1',
        suiteName: 'Checkout',
      },
    });
    expect(prisma.suite.update).not.toHaveBeenCalled();
    expect(prisma.suiteProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'approved' }) as unknown,
      }),
    );
  });

  it('a second Aeris proposal may refresh a name Aeris set before', async () => {
    const prisma = createPrisma();
    prisma.suiteProposal.findFirst.mockResolvedValue({
      ...suiteProposalRow,
      suite: { name: 'Carrito', nameSource: 'aeris' },
    });

    const result = await build(prisma).approveSuiteProposal(
      org,
      'suite-proposal-1',
    );

    expect(result.ok && result.value.applied).toBe(true);
    expect(prisma.suite.update).toHaveBeenCalledTimes(1);
  });

  it('rejecting marks the proposal and leaves the suite alone', async () => {
    const prisma = createPrisma();
    prisma.suiteProposal.findFirst.mockResolvedValue(suiteProposalRow);

    const result = await build(prisma).rejectSuiteProposal(
      org,
      'suite-proposal-1',
    );

    expect(result).toEqual({
      ok: true,
      value: {
        proposalId: 'suite-proposal-1',
        applied: false,
        suiteId: 'suite-1',
        suiteName: 'cart.spec.ts',
      },
    });
    expect(prisma.suite.update).not.toHaveBeenCalled();
    expect(prisma.suiteProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'rejected' }) as unknown,
      }),
    );
  });

  it('refuses to decide a proposal that is no longer in review', async () => {
    const prisma = createPrisma();
    prisma.suiteProposal.findFirst.mockResolvedValue({
      ...suiteProposalRow,
      status: 'approved',
    });

    const result = await build(prisma).approveSuiteProposal(
      org,
      'suite-proposal-1',
    );

    expect(result).toEqual({ ok: false, error: 'invalid-transition' });
  });
});

describe('ReviewService.publish locale', () => {
  it('copies the proposal locale onto the published version', async () => {
    const prisma = createPrisma({ locale: 'es' } as never);

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    const [call] = prisma.testCaseVersion.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toMatchObject({ locale: 'es' });
  });
});
