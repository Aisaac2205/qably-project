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
};

interface FakePrisma {
  extractedProposal: { findFirst: jest.Mock; update: jest.Mock };
  suite: { findFirst: jest.Mock };
  testCase: { create: jest.Mock; update: jest.Mock };
  testCaseVersion: { count: jest.Mock; create: jest.Mock };
  reviewDecision: { create: jest.Mock };
  traceabilityLink: { createMany: jest.Mock };
  $transaction: jest.Mock;
}

function createPrisma(overrides: Partial<typeof proposalRow> = {}): FakePrisma {
  const prisma: FakePrisma = {
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue({ ...proposalRow, ...overrides }),
      update: jest.fn().mockResolvedValue({ id: 'proposal-1' }),
    },
    suite: {
      findFirst: jest.fn().mockResolvedValue({ id: 'suite-1' }),
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
    traceabilityLink: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
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
    });
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
        versionId: 'version-3',
        version: 3,
        decisionId: 'decision-1',
      },
    });
    expect(prisma.testCase.create).not.toHaveBeenCalled();
  });

  it('points the official case at the version it just published', async () => {
    const prisma = createPrisma();

    await build(prisma).approve(org, 'proposal-1', { actorId: 'user-1' });

    expect(prisma.testCase.update).toHaveBeenCalledWith({
      where: { id: 'case-new' },
      data: { currentVersionId: 'version-1' },
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

  it('returns missing-suite when the project has no suite to publish into', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);

    const result = await build(prisma).approve(org, 'proposal-1', {
      actorId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'missing-suite' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
