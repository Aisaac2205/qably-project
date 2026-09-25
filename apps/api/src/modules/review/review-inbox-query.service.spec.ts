import type { OrgContext } from '../organizations/organizations.contracts';
import { encodeInboxCursor } from './lib/inbox-cursor';
import { ReviewInboxQueryService } from './review-inbox-query.service';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

const row = {
  id: 'proposal-1',
  projectId: 'project-1',
  status: 'in_review',
  title: 'Empties the cart',
  objective: 'Confirm the cart resets',
  preconditions: ['A signed-in user'],
  steps: ['Open the cart'],
  expectedResult: 'The cart shows zero items',
  priority: 'high',
  evidenceId: 'evidence-1',
  targetTestCaseId: null as string | null,
  targetTestCase: null as Record<string, unknown> | null,
  evidence: {
    id: 'evidence-1',
    projectId: 'project-1',
    kind: 'SOURCE_EXCERPT',
    title: 'src/cart.spec.ts',
    uri: 'https://example.test/cart.spec.ts',
    excerpt: null as string | null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  codeChange: null as Record<string, unknown> | null,
  duplicateKind: null as string | null,
  matchedCaseId: null as string | null,
  matchedCase: null as Record<string, unknown> | null,
};

interface FakePrisma {
  extractedProposal: { findMany: jest.Mock; findFirst: jest.Mock };
  testCase: { findMany: jest.Mock };
  traceabilityLink: { findMany: jest.Mock };
  runCase: { findMany: jest.Mock };
  reviewDecision: { findFirst: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    extractedProposal: {
      findMany: jest.fn().mockResolvedValue([row]),
      findFirst: jest.fn().mockResolvedValue(row),
    },
    testCase: { findMany: jest.fn().mockResolvedValue([]) },
    traceabilityLink: { findMany: jest.fn().mockResolvedValue([]) },
    runCase: { findMany: jest.fn().mockResolvedValue([]) },
    reviewDecision: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

interface FakeDecisions {
  lastDecision: jest.Mock;
}

function fakeDecisions(overrides: Partial<FakeDecisions> = {}): FakeDecisions {
  return { lastDecision: jest.fn().mockResolvedValue(null), ...overrides };
}

function build(prisma: FakePrisma, decisions: FakeDecisions = fakeDecisions()) {
  return new ReviewInboxQueryService(prisma as never, decisions as never);
}

describe('ReviewInboxQueryService.findOne', () => {
  it('returns not-found for a proposal outside the organization', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue(null);

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result).toEqual({ ok: false, error: 'not-found' });
  });

  it('returns the proposal with its evidence and traceability links', async () => {
    const prisma = createPrisma();
    const evidence = {
      id: 'evidence-1',
      projectId: 'project-1',
      kind: 'SOURCE_EXCERPT',
      title: 'cart.spec.ts',
      uri: 'https://example.test/cart.spec.ts',
      excerpt: 'it("empties", ...)',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      evidence,
    });
    prisma.traceabilityLink.findMany.mockResolvedValue([
      {
        id: 'link-1',
        fromType: 'proposal',
        fromId: 'proposal-1',
        toType: 'evidence',
        toId: 'evidence-1',
        relation: 'evidence_for',
      },
    ]);

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.evidence).toEqual({
      id: 'evidence-1',
      projectId: 'project-1',
      kind: 'source_excerpt',
      title: 'cart.spec.ts',
      uri: 'https://example.test/cart.spec.ts',
      excerpt: 'it("empties", ...)',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.value.links).toEqual([
      {
        id: 'link-1',
        from: { type: 'proposal', id: 'proposal-1' },
        to: { type: 'evidence', id: 'evidence-1' },
        relation: 'evidence_for',
      },
    ]);
  });

  it('maps targetTestCaseId onto the frontend contract name', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      targetTestCaseId: 'case-9',
      evidence: null,
    });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.targetOfficialTestCaseId).toBe('case-9');
  });

  it('exposes the target case suite id so the client can offer to re-document it in place', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      targetTestCaseId: 'case-9',
      targetTestCase: {
        id: 'case-9',
        name: 'Empties the cart',
        suiteId: 'suite-9',
        suite: { name: 'Cart suite' },
        currentVersion: null,
      },
      evidence: null,
    });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.targetOfficialTestCaseSuiteId).toBe('suite-9');
  });

  it('returns a null matchedCase when the proposal has no target and no duplicate classification', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.matchedCase).toBeNull();
  });

  it('prefers the explicit target case over a duplicate-classification match for matchedCase', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      targetTestCaseId: 'case-target',
      targetTestCase: {
        id: 'case-target',
        name: 'Empties the cart',
        suiteId: 'suite-1',
        suite: { name: 'Cart suite' },
        currentVersion: null,
      },
      duplicateKind: 'possible_duplicate',
      matchedCaseId: 'case-duplicate',
      matchedCase: {
        id: 'case-duplicate',
        name: 'A different case',
        suiteId: 'suite-2',
        suite: { name: 'Checkout suite' },
        currentVersion: null,
      },
    });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matchedCase).toEqual({
        id: 'case-target',
        name: 'Empties the cart',
        suiteId: 'suite-1',
        suiteName: 'Cart suite',
      });
    }
  });

  it('falls back to the duplicate-classification match for matchedCase when there is no explicit target', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      duplicateKind: 'possible_duplicate',
      matchedCaseId: 'case-duplicate',
      matchedCase: {
        id: 'case-duplicate',
        name: 'A different case',
        suiteId: 'suite-2',
        suite: { name: 'Checkout suite' },
        currentVersion: null,
      },
    });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matchedCase).toEqual({
        id: 'case-duplicate',
        name: 'A different case',
        suiteId: 'suite-2',
        suiteName: 'Checkout suite',
      });
    }
  });

  it('returns a null publishedVersion when the matched case has never been published', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      targetTestCaseId: 'case-9',
      targetTestCase: {
        id: 'case-9',
        name: 'Empties the cart',
        suiteId: 'suite-9',
        suite: { name: 'Cart suite' },
        currentVersion: null,
      },
    });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.publishedVersion).toBeNull();
  });

  it('resolves publishedBy from the approved decision made at the same instant as the version was published', async () => {
    const prisma = createPrisma();
    const publishedAt = new Date('2026-02-01T10:00:00.000Z');
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      targetTestCaseId: 'case-9',
      targetTestCase: {
        id: 'case-9',
        name: 'Empties the cart',
        suiteId: 'suite-9',
        suite: { name: 'Cart suite' },
        currentVersion: {
          version: 2,
          title: 'Empties the cart',
          objective: 'Confirm the cart resets',
          preconditions: [],
          steps: ['Open the cart', 'Remove every item'],
          expectedResult: 'The cart shows zero items',
          publishedAt,
        },
      },
    });
    prisma.reviewDecision.findFirst.mockResolvedValue({
      actor: { id: 'user-2', name: 'Grace Hopper' },
    });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.publishedVersion).toEqual({
        version: 2,
        title: 'Empties the cart',
        objective: 'Confirm the cart resets',
        preconditions: [],
        steps: ['Open the cart', 'Remove every item'],
        expectedResult: 'The cart shows zero items',
        publishedAt: publishedAt.toISOString(),
        publishedBy: { id: 'user-2', name: 'Grace Hopper' },
      });
    }
    expect(prisma.reviewDecision.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: 'approved',
          decidedAt: publishedAt,
        }) as unknown,
      }),
    );
  });

  it('reports publishedBy as null when no approved decision matches the version (a manual edit)', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      targetTestCaseId: 'case-9',
      targetTestCase: {
        id: 'case-9',
        name: 'Empties the cart',
        suiteId: 'suite-9',
        suite: { name: 'Cart suite' },
        currentVersion: {
          version: 3,
          title: 'Empties the cart',
          objective: '',
          preconditions: [],
          steps: ['Open the cart'],
          expectedResult: 'The cart is empty',
          publishedAt: new Date('2026-03-01T00:00:00.000Z'),
        },
      },
    });
    prisma.reviewDecision.findFirst.mockResolvedValue(null);

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.publishedVersion?.publishedBy).toBeNull();
  });

  it('returns a null source when the proposal has no code change', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.source).toBeNull();
  });

  it('returns the code change as source, normalizing an empty commitSha to null', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      codeChange: {
        filePath: 'src/cart.ts',
        commitSha: '',
        pullRequestNumber: null,
      },
    });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toEqual({
        filePath: 'src/cart.ts',
        uri: 'https://example.test/cart.spec.ts',
        commitSha: null,
        pullRequestNumber: null,
      });
    }
  });

  it('returns the code change commit and PR number as source when present', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      codeChange: {
        filePath: 'src/cart.ts',
        commitSha: 'abc123',
        pullRequestNumber: 42,
      },
    });

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toEqual({
        filePath: 'src/cart.ts',
        uri: 'https://example.test/cart.spec.ts',
        commitSha: 'abc123',
        pullRequestNumber: 42,
      });
    }
  });

  it('returns an empty recentRuns array and skips the query when there is no matched case', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.recentRuns).toEqual([]);
    expect(prisma.runCase.findMany).not.toHaveBeenCalled();
  });

  it('returns at most 5 recorded runs for the matched case, most recent first', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      ...row,
      targetTestCaseId: 'case-9',
      targetTestCase: {
        id: 'case-9',
        name: 'Empties the cart',
        suiteId: 'suite-9',
        suite: { name: 'Cart suite' },
        currentVersion: null,
      },
    });
    prisma.runCase.findMany.mockResolvedValue([
      {
        runId: 'run-1',
        status: 'pass',
        recordedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);

    const result = await build(prisma).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.recentRuns).toEqual([
        {
          runId: 'run-1',
          status: 'pass',
          recordedAt: '2026-02-01T00:00:00.000Z',
        },
      ]);
    }
    expect(prisma.runCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { testCaseId: 'case-9', recordedAt: { not: null } },
        orderBy: { recordedAt: 'desc' },
        take: 5,
      }),
    );
  });

  it('returns the decision from ReviewDecisionService.lastDecision', async () => {
    const prisma = createPrisma();
    const decision = {
      action: 'approved' as const,
      decidedAt: '2026-01-05T12:00:00.000Z',
      decidedBy: { id: 'user-2', name: 'Grace Hopper' },
    };
    const decisions = fakeDecisions({
      lastDecision: jest.fn().mockResolvedValue(decision),
    });

    const result = await build(prisma, decisions).findOne(org, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.decision).toEqual(decision);
    expect(decisions.lastDecision).toHaveBeenCalledWith(org, 'proposal-1');
  });
});

const serviceOrg: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

type ServiceFixtureStatus = 'in_review' | 'approved' | 'rejected';

const serviceProposalRow = {
  id: 'proposal-1',
  projectId: 'project-1',
  status: 'in_review' as ServiceFixtureStatus,
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
  matchedCase: null as Record<string, unknown> | null,
  needsManualReview: false,
};

interface ServiceFakePrisma {
  extractedProposal: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  testCase: { findMany: jest.Mock };
  traceabilityLink: { findMany: jest.Mock };
  runCase: { findMany: jest.Mock };
  reviewDecision: { findFirst: jest.Mock };
}

function createServicePrisma(
  overrides: Partial<typeof serviceProposalRow> = {},
): ServiceFakePrisma {
  return {
    extractedProposal: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ ...serviceProposalRow, ...overrides }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    testCase: { findMany: jest.fn().mockResolvedValue([]) },
    traceabilityLink: { findMany: jest.fn().mockResolvedValue([]) },
    runCase: { findMany: jest.fn().mockResolvedValue([]) },
    reviewDecision: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

function buildService(prisma: object) {
  return new ReviewInboxQueryService(
    prisma as never,
    { lastDecision: jest.fn().mockResolvedValue(null) } as never,
  );
}

describe('ReviewInboxQueryService.findOne (from review.service.spec)', () => {
  it('tells the reviewer when a proposal was flagged for manual review', async () => {
    const prisma = createServicePrisma({
      steps: [],
      expectedResult: '',
      objective: 'extraction-failed',
      needsManualReview: true,
      evidence: null,
    });

    const result = await buildService(prisma).findOne(serviceOrg, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.needsManualReview).toBe(true);
      expect(result.value.steps).toEqual([]);
    }
  });

  it('reports an ordinary proposal as not needing manual review', async () => {
    const prisma = createServicePrisma({ evidence: null });

    const result = await buildService(prisma).findOne(serviceOrg, 'proposal-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.needsManualReview).toBe(false);
  });
});

interface PageFakePrisma {
  extractedProposal: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    groupBy: jest.Mock;
  };
  testCase: { findMany: jest.Mock };
  traceabilityLink: { findMany: jest.Mock };
}

function createPageFixture(rows: Record<string, unknown>[]): PageFakePrisma {
  return {
    extractedProposal: {
      findMany: jest.fn().mockResolvedValue(rows),
      findFirst: jest.fn().mockResolvedValue(null),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    testCase: { findMany: jest.fn().mockResolvedValue([]) },
    traceabilityLink: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function pageRow(overrides: Record<string, unknown> = {}) {
  return {
    ...serviceProposalRow,
    locale: null,
    observations: null,
    evidence: { title: 'src/cart.spec.ts' },
    createdAt: new Date('2026-09-24T10:00:00.000Z'),
    suite: null as { id: string; name: string } | null,
    duplicateKind: null as string | null,
    matchedCaseId: null as string | null,
    duplicateScore: null as number | null,
    duplicateReasons: null as unknown,
    ...overrides,
  };
}

describe('ReviewInboxQueryService.page', () => {
  it('orders by createdAt desc, id desc and requests one extra row to detect the next page', async () => {
    const prisma = createPageFixture([pageRow()]);

    await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
    });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ orderBy: unknown; take: number }],
    ];
    expect(call[0].orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(call[0].take).toBe(51);
  });

  it('returns nextCursor null when fewer rows than the limit come back', async () => {
    const prisma = createPageFixture([pageRow()]);

    const result = await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
    });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('returns an encoded nextCursor pointing at the last item on the page when more rows remain', async () => {
    const rows = Array.from({ length: 3 }, (_, index) =>
      pageRow({
        id: `proposal-${index}`,
        createdAt: new Date(2026, 8, 24, 10, index),
      }),
    );
    const prisma = createPageFixture(rows);

    const result = await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe(
      encodeInboxCursor({
        createdAt: rows[1].createdAt.toISOString(),
        id: 'proposal-1',
      }),
    );
  });

  it('applies the keyset filter from a decoded cursor', async () => {
    const prisma = createPageFixture([]);
    const cursor = encodeInboxCursor({
      createdAt: '2026-09-24T10:00:00.000Z',
      id: 'proposal-5',
    });

    await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
      cursor,
    });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: { AND: unknown[] } }],
    ];
    expect(call[0].where.AND).toEqual([
      expect.objectContaining({
        project: { organizationId: 'org-1' },
      }) as unknown,
      {
        OR: [
          { createdAt: { lt: new Date('2026-09-24T10:00:00.000Z') } },
          {
            createdAt: new Date('2026-09-24T10:00:00.000Z'),
            id: { lt: 'proposal-5' },
          },
        ],
      },
    ]);
  });

  it('searches title and objective case-insensitively', async () => {
    const prisma = createPageFixture([]);

    await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
      search: 'cart',
    });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: { OR: unknown } }],
    ];
    expect(call[0].where.OR).toEqual([
      { title: { contains: 'cart', mode: 'insensitive' } },
      { objective: { contains: 'cart', mode: 'insensitive' } },
    ]);
  });

  it('filters by the persisted possible_duplicate classification, paginating normally like every other filter', async () => {
    const prisma = createPageFixture([pageRow({ id: 'dup' })]);

    await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
      duplicatesOnly: true,
    });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: Record<string, unknown>; take: number }],
    ];
    expect(call[0].where).toMatchObject({
      duplicateKind: 'possible_duplicate',
    });
    expect(call[0].take).toBe(51);
  });

  it('combines duplicatesOnly with the cursor keyset filter, instead of replacing it', async () => {
    const prisma = createPageFixture([]);
    const cursor = encodeInboxCursor({
      createdAt: '2026-09-24T10:00:00.000Z',
      id: 'proposal-5',
    });

    await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
      cursor,
      duplicatesOnly: true,
    });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: { AND: Record<string, unknown>[] } }],
    ];
    expect(call[0].where.AND[0]).toMatchObject({
      duplicateKind: 'possible_duplicate',
    });
  });

  it('omits the status filter entirely when status is "all"', async () => {
    const prisma = createPageFixture([pageRow()]);

    await buildService(prisma).page(serviceOrg, {
      status: 'all',
      limit: 50,
    });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    expect(call[0].where).not.toHaveProperty('status');
  });

  it('renders a never-classified proposal as classification kind none', async () => {
    const prisma = createPageFixture([pageRow({ duplicateKind: null })]);

    const result = await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
    });

    expect(result.items[0].classification).toEqual({
      kind: 'none',
      matchedCaseId: null,
      matchedCaseName: null,
      score: null,
      reasons: [],
    });
  });

  it('surfaces the persisted classification for a proposal that has been classified', async () => {
    const prisma = createPageFixture([
      pageRow({
        duplicateKind: 'possible_duplicate',
        matchedCaseId: 'case-9',
        matchedCase: { name: 'Empties the cart' },
        duplicateScore: 0.75,
        duplicateReasons: ['same-title', 'steps-overlap'],
      }),
    ]);

    const result = await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
    });

    expect(result.items[0].classification).toEqual({
      kind: 'possible_duplicate',
      matchedCaseId: 'case-9',
      matchedCaseName: 'Empties the cart',
      score: 0.75,
      reasons: ['same-title', 'steps-overlap'],
    });
  });

  it('reports a null matchedCaseName when the matched case was deleted after classification', async () => {
    const prisma = createPageFixture([
      pageRow({
        duplicateKind: 'update',
        matchedCaseId: 'case-9',
        matchedCase: null,
      }),
    ]);

    const result = await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
    });

    expect(result.items[0].classification.matchedCaseName).toBeNull();
  });

  it('includes the suite id and name when the proposal has a suite', async () => {
    const prisma = createPageFixture([
      pageRow({ suite: { id: 'suite-1', name: 'Checkout' } }),
    ]);

    const result = await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
    });

    expect(result.items[0].suite).toEqual({ id: 'suite-1', name: 'Checkout' });
  });

  it('reports a null suite when the proposal has none', async () => {
    const prisma = createPageFixture([pageRow({ suite: null })]);

    const result = await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
    });

    expect(result.items[0].suite).toBeNull();
  });

  it('selects the classification and suite fields needed for the inbox contract', async () => {
    const prisma = createPageFixture([pageRow()]);

    await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 50,
    });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ select: Record<string, unknown> }],
    ];
    expect(call[0].select).toMatchObject({
      suite: { select: { id: true, name: true } },
      duplicateKind: true,
      matchedCaseId: true,
      matchedCase: { select: { name: true } },
      duplicateScore: true,
      duplicateReasons: true,
    });
  });
});

describe('ReviewInboxQueryService.counts', () => {
  it('returns zero counts for every status when nothing matches', async () => {
    const prisma = createPageFixture([]);

    const result = await buildService(prisma).counts(serviceOrg, {});

    expect(result.byStatus).toEqual({
      in_review: 0,
      approved: 0,
      rejected: 0,
      changes_requested: 0,
    });
  });

  it('maps groupBy rows onto byStatus by status name', async () => {
    const prisma = createPageFixture([]);
    prisma.extractedProposal.groupBy.mockResolvedValue([
      {
        status: 'in_review',
        _count: { _all: 7 },
        _max: { updatedAt: new Date('2026-09-24T10:00:00.000Z') },
      },
      {
        status: 'approved',
        _count: { _all: 3 },
        _max: { updatedAt: new Date('2026-09-23T10:00:00.000Z') },
      },
    ]);

    const result = await buildService(prisma).counts(serviceOrg, {});

    expect(result.byStatus).toEqual({
      in_review: 7,
      approved: 3,
      rejected: 0,
      changes_requested: 0,
    });
  });

  it('produces a version hash that changes when the counts change', async () => {
    const prisma = createPageFixture([]);
    prisma.extractedProposal.groupBy.mockResolvedValue([
      {
        status: 'in_review',
        _count: { _all: 7 },
        _max: { updatedAt: new Date('2026-09-24T10:00:00.000Z') },
      },
    ]);

    const first = await buildService(prisma).counts(serviceOrg, {});

    prisma.extractedProposal.groupBy.mockResolvedValue([
      {
        status: 'in_review',
        _count: { _all: 8 },
        _max: { updatedAt: new Date('2026-09-24T10:00:00.000Z') },
      },
    ]);

    const second = await buildService(prisma).counts(serviceOrg, {});

    expect(first.version).not.toBe(second.version);
  });

  it('returns zero byDuplicateKind counts when nothing matches', async () => {
    const prisma = createPageFixture([]);

    const result = await buildService(prisma).counts(serviceOrg, {});

    expect(result.byDuplicateKind).toEqual({
      none: 0,
      update: 0,
      possible_duplicate: 0,
    });
  });

  it('maps groupBy duplicateKind rows onto byDuplicateKind by kind name', async () => {
    const prisma = createPageFixture([]);
    prisma.extractedProposal.groupBy.mockImplementation(
      (args: { by: string[] }) =>
        Promise.resolve(
          args.by[0] === 'duplicateKind'
            ? [
                {
                  duplicateKind: 'possible_duplicate',
                  _count: { _all: 4 },
                  _max: { updatedAt: new Date('2026-09-24T10:00:00.000Z') },
                },
                {
                  duplicateKind: 'update',
                  _count: { _all: 2 },
                  _max: { updatedAt: new Date('2026-09-23T10:00:00.000Z') },
                },
              ]
            : [],
        ),
    );

    const result = await buildService(prisma).counts(serviceOrg, {});

    expect(result.byDuplicateKind).toEqual({
      none: 0,
      update: 2,
      possible_duplicate: 4,
    });
  });

  it('folds a null duplicateKind bucket and an explicit "none" bucket into the same none count', async () => {
    const prisma = createPageFixture([]);
    prisma.extractedProposal.groupBy.mockImplementation(
      (args: { by: string[] }) =>
        Promise.resolve(
          args.by[0] === 'duplicateKind'
            ? [
                {
                  duplicateKind: null,
                  _count: { _all: 3 },
                  _max: { updatedAt: new Date('2026-09-24T10:00:00.000Z') },
                },
                {
                  duplicateKind: 'none',
                  _count: { _all: 5 },
                  _max: { updatedAt: new Date('2026-09-23T10:00:00.000Z') },
                },
              ]
            : [],
        ),
    );

    const result = await buildService(prisma).counts(serviceOrg, {});

    expect(result.byDuplicateKind.none).toBe(8);
  });

  it('changes the version hash when byDuplicateKind counts change, even if byStatus stays the same', async () => {
    const prisma = createPageFixture([]);
    prisma.extractedProposal.groupBy.mockImplementation(
      (args: { by: string[] }) =>
        Promise.resolve(
          args.by[0] === 'duplicateKind'
            ? [
                {
                  duplicateKind: 'possible_duplicate',
                  _count: { _all: 1 },
                  _max: { updatedAt: new Date('2026-09-24T10:00:00.000Z') },
                },
              ]
            : [],
        ),
    );

    const first = await buildService(prisma).counts(serviceOrg, {});

    prisma.extractedProposal.groupBy.mockImplementation(
      (args: { by: string[] }) =>
        Promise.resolve(
          args.by[0] === 'duplicateKind'
            ? [
                {
                  duplicateKind: 'possible_duplicate',
                  _count: { _all: 2 },
                  _max: { updatedAt: new Date('2026-09-24T10:00:00.000Z') },
                },
              ]
            : [],
        ),
    );

    const second = await buildService(prisma).counts(serviceOrg, {});

    expect(first.version).not.toBe(second.version);
  });
});
