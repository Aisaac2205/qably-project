import type { OrgContext } from '../organizations/organizations.contracts';
import type { ProposalReclassifier } from '../proposal-classification/proposal-reclassifier';
import { ReviewDecisionService } from './review-decision.service';

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
  extractedProposal: {
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  suite: { findFirst: jest.Mock; update: jest.Mock };
  testCase: { create: jest.Mock; update: jest.Mock };
  testCaseVersion: { count: jest.Mock; create: jest.Mock };
  reviewDecision: { create: jest.Mock; findFirst: jest.Mock };
  traceabilityLink: { createMany: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
}

function createPrisma(overrides: Partial<typeof proposalRow> = {}): FakePrisma {
  const prisma: FakePrisma = {
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue({ ...proposalRow, ...overrides }),
      update: jest.fn().mockResolvedValue({ id: 'proposal-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      findFirst: jest.fn().mockResolvedValue(null),
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

function fakeReclassifier(
  enqueue: jest.Mock = jest.fn().mockResolvedValue(undefined),
): ProposalReclassifier {
  return { enqueue } as unknown as ProposalReclassifier;
}

function build(
  prisma: FakePrisma,
  reclassifier: ProposalReclassifier = fakeReclassifier(),
) {
  return new ReviewDecisionService(prisma as never, reclassifier);
}

describe('ReviewDecisionService.approve', () => {
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
        objective: 'Confirm the cart resets',
        preconditions: ['A signed-in user'],
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
        objective: 'Confirm the cart resets',
        preconditions: ['A signed-in user'],
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
        objective: 'Confirm the cart resets',
        preconditions: ['A signed-in user'],
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

  it('records the produced, version_of, and proposal-to-version traceability links', async () => {
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
          {
            projectId: 'project-1',
            fromType: 'proposal',
            fromId: 'proposal-1',
            toType: 'test_case_version',
            toId: 'version-1',
            relation: 'produced',
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

  it('returns name-taken when refreshing an existing case collides, and commits no link or decision', async () => {
    const prisma = createPrisma({ targetTestCaseId: 'case-existing' });
    prisma.testCase.update.mockRejectedValue({ code: 'P2002' });

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'name-taken' });
    expect(prisma.traceabilityLink.createMany).not.toHaveBeenCalled();
    expect(prisma.reviewDecision.create).not.toHaveBeenCalled();
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

  it('claims the proposal atomically, conditioned on it still being in_review, before publishing', async () => {
    const prisma = createPrisma();

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    expect(prisma.extractedProposal.updateMany).toHaveBeenCalledWith({
      where: { id: 'proposal-1', status: 'in_review' },
      data: { status: 'approved' },
    });
    const [claimOrder] =
      prisma.extractedProposal.updateMany.mock.invocationCallOrder;
    const [createOrder] = prisma.testCase.create.mock.invocationCallOrder;
    expect(claimOrder).toBeLessThan(createOrder);
  });

  it('returns invalid-transition and publishes nothing when a concurrent decision wins the claim', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.updateMany.mockResolvedValue({ count: 0 });

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'invalid-transition' });
    expect(prisma.testCase.create).not.toHaveBeenCalled();
    expect(prisma.testCaseVersion.create).not.toHaveBeenCalled();
    expect(prisma.traceabilityLink.createMany).not.toHaveBeenCalled();
    expect(prisma.reviewDecision.create).not.toHaveBeenCalled();
  });

  it('enqueues a reclassify job for the suite of a newly created case', async () => {
    const prisma = createPrisma();
    const enqueue = jest.fn().mockResolvedValue(undefined);

    await build(prisma, fakeReclassifier(enqueue)).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(enqueue).toHaveBeenCalledWith('suite-1');
  });

  it('enqueues a reclassify job for the suite of an existing target case', async () => {
    const prisma = createPrisma({
      targetTestCaseId: 'case-existing',
      suiteId: 'suite-of-existing-case',
    });
    const enqueue = jest.fn().mockResolvedValue(undefined);

    await build(prisma, fakeReclassifier(enqueue)).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(enqueue).toHaveBeenCalledWith('suite-of-existing-case');
  });

  it('never enqueues a reclassify job when a concurrent decision wins the claim', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.updateMany.mockResolvedValue({ count: 0 });
    const enqueue = jest.fn().mockResolvedValue(undefined);

    await build(prisma, fakeReclassifier(enqueue)).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('ReviewDecisionService.reject', () => {
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
    expect(prisma.extractedProposal.updateMany).toHaveBeenCalledWith({
      where: { id: 'proposal-1', status: 'in_review' },
      data: { status: 'rejected' },
    });
  });

  it('claims the proposal atomically, conditioned on it still being in_review, before recording the rejection', async () => {
    const prisma = createPrisma();

    await build(prisma).reject(org, 'proposal-1', { actorId: 'user-1' });

    const [claimOrder] =
      prisma.extractedProposal.updateMany.mock.invocationCallOrder;
    const [decisionOrder] =
      prisma.reviewDecision.create.mock.invocationCallOrder;
    expect(claimOrder).toBeLessThan(decisionOrder);
  });

  it('returns invalid-transition and records no decision when a concurrent decision wins the claim', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.updateMany.mockResolvedValue({ count: 0 });

    const result = await build(prisma).reject(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'invalid-transition' });
    expect(prisma.reviewDecision.create).not.toHaveBeenCalled();
  });

  it('never enqueues a reclassify job on reject, since nothing about the case identity changed', async () => {
    const prisma = createPrisma();
    const enqueue = jest.fn().mockResolvedValue(undefined);

    await build(prisma, fakeReclassifier(enqueue)).reject(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(enqueue).not.toHaveBeenCalled();
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

describe('ReviewDecisionService.publish locale', () => {
  it('copies the proposal locale onto the published version', async () => {
    const prisma = createPrisma({ locale: 'es' } as never);

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    const [call] = prisma.testCaseVersion.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(call[0].data).toMatchObject({ locale: 'es' });
  });
});

describe('ReviewDecisionService.lastDecision', () => {
  it('returns the most recent decision with the actor who made it', async () => {
    const prisma = createPrisma();
    prisma.reviewDecision.findFirst.mockResolvedValue({
      action: 'approved',
      decidedAt: new Date('2026-01-05T12:00:00.000Z'),
      actor: { id: 'user-2', name: 'Grace Hopper' },
    });

    const decision = await build(prisma).lastDecision(org, 'proposal-1');

    expect(decision).toEqual({
      action: 'approved',
      decidedAt: '2026-01-05T12:00:00.000Z',
      decidedBy: { id: 'user-2', name: 'Grace Hopper' },
    });
  });

  it('returns a different action for a rejected proposal', async () => {
    const prisma = createPrisma();
    prisma.reviewDecision.findFirst.mockResolvedValue({
      action: 'rejected',
      decidedAt: new Date('2026-02-01T08:30:00.000Z'),
      actor: { id: 'user-3', name: 'Ada Lovelace' },
    });

    const decision = await build(prisma).lastDecision(org, 'proposal-1');

    expect(decision).toEqual({
      action: 'rejected',
      decidedAt: '2026-02-01T08:30:00.000Z',
      decidedBy: { id: 'user-3', name: 'Ada Lovelace' },
    });
  });

  it('returns null when the proposal has no recorded decision', async () => {
    const prisma = createPrisma();
    prisma.reviewDecision.findFirst.mockResolvedValue(null);

    const decision = await build(prisma).lastDecision(org, 'proposal-1');

    expect(decision).toBeNull();
  });

  it('scopes the lookup to the caller organization', async () => {
    const prisma = createPrisma();
    prisma.reviewDecision.findFirst.mockResolvedValue(null);

    await build(prisma).lastDecision(org, 'proposal-1');

    const [call] = prisma.reviewDecision.findFirst.mock.calls as [
      [
        {
          where: {
            proposalId: string;
            proposal: { project: { organizationId: string } };
          };
        },
      ],
    ];
    expect(call[0].where).toMatchObject({
      proposalId: 'proposal-1',
      proposal: { project: { organizationId: 'org-1' } },
    });
  });

  it('breaks decidedAt ties by ordering id desc, most recent first', async () => {
    const prisma = createPrisma();
    prisma.reviewDecision.findFirst.mockResolvedValue(null);

    await build(prisma).lastDecision(org, 'proposal-1');

    const [call] = prisma.reviewDecision.findFirst.mock.calls as [
      [{ orderBy: Array<Record<string, 'desc'>> }],
    ];
    expect(call[0].orderBy).toEqual([{ decidedAt: 'desc' }, { id: 'desc' }]);
  });

  it('throws instead of silently trusting an unexpected decision action', async () => {
    const prisma = createPrisma();
    prisma.reviewDecision.findFirst.mockResolvedValue({
      action: 'changes_requested',
      decidedAt: new Date('2026-02-01T08:30:00.000Z'),
      actor: { id: 'user-3', name: 'Ada Lovelace' },
    });

    await expect(build(prisma).lastDecision(org, 'proposal-1')).rejects.toThrow(
      'Unexpected review decision action: changes_requested',
    );
  });
});
