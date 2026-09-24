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
  targetTestCaseId: null,
  targetTestCase: null,
  evidence: { title: 'src/cart.spec.ts' },
};

interface FakePrisma {
  extractedProposal: { findMany: jest.Mock; findFirst: jest.Mock };
  testCase: { findMany: jest.Mock };
  traceabilityLink: { findMany: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    extractedProposal: {
      findMany: jest.fn().mockResolvedValue([row]),
      findFirst: jest.fn().mockResolvedValue(row),
    },
    testCase: { findMany: jest.fn().mockResolvedValue([]) },
    traceabilityLink: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function build(prisma: FakePrisma) {
  return new ReviewInboxQueryService(prisma as never);
}

describe('ReviewInboxQueryService.list', () => {
  it('scopes every query to the organization', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, {});

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    expect(call[0].where).toMatchObject({
      project: { organizationId: 'org-1' },
    });
  });

  it('maps targetTestCaseId onto the frontend contract name', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).list(org, {});

    expect(result[0]).toEqual({
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
      evidenceTitle: 'src/cart.spec.ts',
      locale: null,
    });
  });

  it('carries the evidence title so the queue never fetches it per row', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, {});

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ select: { evidence: unknown } }],
    ];
    expect(call[0].select.evidence).toEqual({ select: { title: true } });
  });

  it('exposes the documentation target when the proposal has one', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      { ...row, targetTestCaseId: 'case-9' },
    ]);

    const result = await build(prisma).list(org, {});

    expect(result[0].targetOfficialTestCaseId).toBe('case-9');
  });

  it('filters by project and status when asked', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, {
      projectId: 'project-1',
      status: 'approved',
    });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    expect(call[0].where).toMatchObject({
      projectId: 'project-1',
      status: 'approved',
    });
  });

  it('resolves duplicatesOnly against real matches, never against the documentation target', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).list(org, { duplicatesOnly: true });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    expect(call[0].where).not.toHaveProperty('targetTestCaseId');
    expect(result).toEqual([]);
  });

  it('searches title and objective case-insensitively', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { search: 'cart' });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: { OR: unknown } }],
    ];
    expect(call[0].where.OR).toEqual([
      { title: { contains: 'cart', mode: 'insensitive' } },
      { objective: { contains: 'cart', mode: 'insensitive' } },
    ]);
  });
});

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
  needsManualReview: false,
};

interface ServiceFakePrisma {
  extractedProposal: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  testCase: { findMany: jest.Mock };
  traceabilityLink: { findMany: jest.Mock };
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
  };
}

function buildService(prisma: ServiceFakePrisma) {
  return new ReviewInboxQueryService(prisma as never);
}

function serviceListRow(overrides: Record<string, unknown> = {}) {
  return {
    ...serviceProposalRow,
    locale: null,
    observations: null,
    createdAt: new Date('2026-09-12T10:00:00.000Z'),
    evidence: { title: 'src/cart.spec.ts' },
    ...overrides,
  };
}

function serviceOfficialCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1',
    projectId: 'project-1',
    name: 'Empties the cart',
    automationKey: 'Cart > empties the cart',
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ReviewInboxQueryService.list (from review.service.spec)', () => {
  it('flags an untargeted proposal that matches an existing case in its project', async () => {
    const prisma = createServicePrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      serviceListRow({ automationKey: 'Cart > empties the cart' }),
    ]);
    prisma.testCase.findMany.mockResolvedValue([serviceOfficialCase()]);

    const [view] = await buildService(prisma).list(serviceOrg, {});

    expect(view.possibleDuplicate).toBe(true);
    expect(view.targetOfficialTestCaseId).toBeUndefined();
  });

  it('never flags a proposal that documents a case, however similar it is to that case', async () => {
    const prisma = createServicePrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      serviceListRow({
        targetTestCaseId: 'case-1',
        automationKey: 'Cart > empties the cart',
      }),
    ]);
    prisma.testCase.findMany.mockResolvedValue([serviceOfficialCase()]);

    const [view] = await buildService(prisma).list(serviceOrg, {});

    expect(view.possibleDuplicate).toBeUndefined();
    expect(view.targetOfficialTestCaseId).toBe('case-1');
    expect(prisma.testCase.findMany).not.toHaveBeenCalled();
  });

  it('exposes the target case suite id so the client can offer to re-document it in place', async () => {
    const prisma = createServicePrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      serviceListRow({
        targetTestCaseId: 'case-1',
        targetTestCase: { suiteId: 'suite-9' },
      }),
    ]);

    const [view] = await buildService(prisma).list(serviceOrg, {});

    expect(view.targetOfficialTestCaseSuiteId).toBe('suite-9');
  });

  it('leaves an untargeted proposal unflagged when nothing in the project resembles it', async () => {
    const prisma = createServicePrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      serviceListRow({ title: 'Applies a discount code', automationKey: null }),
    ]);
    prisma.testCase.findMany.mockResolvedValue([serviceOfficialCase()]);

    const [view] = await buildService(prisma).list(serviceOrg, {});

    expect(view.possibleDuplicate).toBeUndefined();
  });

  it('keeps only flagged proposals when duplicatesOnly is requested', async () => {
    const prisma = createServicePrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      serviceListRow({ id: 'dup', automationKey: 'Cart > empties the cart' }),
      serviceListRow({
        id: 'fresh',
        title: 'Applies a discount code',
        automationKey: null,
      }),
      serviceListRow({ id: 'documents', targetTestCaseId: 'case-1' }),
    ]);
    prisma.testCase.findMany.mockResolvedValue([serviceOfficialCase()]);

    const views = await buildService(prisma).list(serviceOrg, {
      duplicatesOnly: true,
    });

    expect(views.map((view) => view.id)).toEqual(['dup']);
  });
});

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

describe('ReviewInboxQueryService.getDuplicateCandidates', () => {
  function officialCase(overrides: Record<string, unknown> = {}) {
    return {
      id: 'case-1',
      name: 'Empties the cart',
      automationKey: null as string | null,
      steps: ['Open the cart', 'Remove every item'],
      expectedResult: 'The cart shows zero items',
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('returns not-found when the proposal is outside the caller organization', async () => {
    const prisma = createServicePrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue(null);

    const result = await buildService(prisma).getDuplicateCandidates(
      serviceOrg,
      'proposal-1',
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(prisma.testCase.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty array when no official case plausibly matches', async () => {
    const prisma = createServicePrisma();
    prisma.testCase.findMany.mockResolvedValue([]);

    const result = await buildService(prisma).getDuplicateCandidates(
      serviceOrg,
      'proposal-1',
    );

    expect(result).toEqual({ ok: true, value: [] });
  });

  it('excludes the proposal own target case from the candidate set', async () => {
    const prisma = createServicePrisma({ targetTestCaseId: 'case-existing' });

    await buildService(prisma).getDuplicateCandidates(serviceOrg, 'proposal-1');

    expect(prisma.testCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'project-1',
          id: { not: 'case-existing' },
        }) as unknown,
      }),
    );
  });

  it('queries candidates with an explicit deterministic order', async () => {
    const prisma = createServicePrisma();

    await buildService(prisma).getDuplicateCandidates(serviceOrg, 'proposal-1');

    expect(prisma.testCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: 'asc' } }),
    );
  });

  it('does not filter by id when the proposal has no target case', async () => {
    const prisma = createServicePrisma();

    await buildService(prisma).getDuplicateCandidates(serviceOrg, 'proposal-1');

    const [call] = prisma.testCase.findMany.mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    expect(call[0].where).not.toHaveProperty('id');
  });

  it('ranks candidates and returns their current published content, capped at 5', async () => {
    const prisma = createServicePrisma();
    prisma.testCase.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) =>
        officialCase({
          id: `case-${index}`,
          updatedAt: new Date(2024, 0, index + 1),
        }),
      ),
    );

    const result = await buildService(prisma).getDuplicateCandidates(
      serviceOrg,
      'proposal-1',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(5);
    expect(result.value[0]).toEqual({
      id: 'case-7',
      title: 'Empties the cart',
      steps: ['Open the cart', 'Remove every item'],
      expectedResult: 'The cart shows zero items',
      matchReason: 'title',
    });
  });

  it('ranks an automation-key match above a title match', async () => {
    const prisma = createServicePrisma({ automationKey: 'Cart.emptiesCart' });
    prisma.testCase.findMany.mockResolvedValue([
      officialCase({ id: 'case-title-only' }),
      officialCase({
        id: 'case-key-match',
        name: 'A completely different title',
        automationKey: 'Cart.emptiesCart',
      }),
    ]);

    const result = await buildService(prisma).getDuplicateCandidates(
      serviceOrg,
      'proposal-1',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((candidate) => candidate.id)).toEqual([
      'case-key-match',
      'case-title-only',
    ]);
    expect(result.value[0].matchReason).toBe('automation-key');
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

  it('ignores cursor and pagination for duplicatesOnly, returning a single unpaginated page', async () => {
    const prisma = createPageFixture([pageRow({ id: 'dup' })]);

    const result = await buildService(prisma).page(serviceOrg, {
      status: 'in_review',
      limit: 1,
      duplicatesOnly: true,
    });

    expect(result.nextCursor).toBeNull();
    const [duplicatesCall] = prisma.extractedProposal.findMany.mock.calls as [
      [Record<string, unknown>],
    ];
    expect(duplicatesCall[0]).not.toHaveProperty('take');
  });

  it('honors the requested limit for duplicatesOnly instead of returning every match', async () => {
    const prisma = createPageFixture([]);
    const service = buildService(prisma);
    jest
      .spyOn(service, 'list')
      .mockResolvedValue([
        pageRow({ id: 'dup-a' }),
        pageRow({ id: 'dup-b' }),
        pageRow({ id: 'dup-c' }),
      ] as never);

    const result = await service.page(serviceOrg, {
      status: 'in_review',
      limit: 2,
      duplicatesOnly: true,
    });

    expect(result.items.map((item) => item.id)).toEqual(['dup-a', 'dup-b']);
    expect(result.nextCursor).toBeNull();
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
});
