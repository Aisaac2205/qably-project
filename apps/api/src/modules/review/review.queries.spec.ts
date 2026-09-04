import type { OrgContext } from '../organizations/organizations.contracts';
import { ReviewService } from './review.service';

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
  evidence: { title: 'src/cart.spec.ts' },
};

interface FakePrisma {
  extractedProposal: { findMany: jest.Mock; findFirst: jest.Mock };
  traceabilityLink: { findMany: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    extractedProposal: {
      findMany: jest.fn().mockResolvedValue([row]),
      findFirst: jest.fn().mockResolvedValue(row),
    },
    traceabilityLink: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function build(prisma: FakePrisma) {
  return new ReviewService(prisma as never);
}

describe('ReviewService.list', () => {
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

  it('exposes the duplicate target when the proposal has one', async () => {
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

  it('keeps only proposals with a duplicate target when duplicatesOnly is set', async () => {
    const prisma = createPrisma();

    await build(prisma).list(org, { duplicatesOnly: true });

    const [call] = prisma.extractedProposal.findMany.mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    expect(call[0].where).toMatchObject({ targetTestCaseId: { not: null } });
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

describe('ReviewService.findOne', () => {
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
