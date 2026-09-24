import type { AuthenticatedUser } from '../auth/auth.contracts';
import { OrganizationsService } from './organizations.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'ada@acme.test',
  name: 'Ada Lovelace',
  emailVerified: true,
  locale: null,
};

interface FakePrisma {
  orgMember: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
  orgInvite: { count: jest.Mock };
  project: { count: jest.Mock };
  organization: { create: jest.Mock; findUniqueOrThrow: jest.Mock };
  $transaction: jest.Mock;
}

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    orgMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    orgInvite: { count: jest.fn().mockResolvedValue(0) },
    project: { count: jest.fn().mockResolvedValue(0) },
    organization: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
  );

  return prisma;
}

function build(prisma: FakePrisma) {
  return new OrganizationsService(prisma as never);
}

describe('OrganizationsService.resolveContext', () => {
  it('returns the existing membership without creating anything', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
      role: 'owner',
      organization: { slug: 'acme' },
    });

    const result = await build(prisma).resolveContext(user);

    expect(result).toEqual({
      ok: true,
      value: { organizationId: 'org-1', slug: 'acme', role: 'owner' },
    });
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it('bootstraps an owner organization the first time a user has none', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(null);
    prisma.organization.create.mockResolvedValue({
      id: 'org-new',
      slug: 'ada-lovelaces-workspace',
    });

    const result = await build(prisma).resolveContext(user);

    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: 'org-new',
        slug: 'ada-lovelaces-workspace',
        role: 'owner',
      },
    });
    expect(prisma.organization.create).toHaveBeenCalledTimes(1);
  });

  it('creates the organization and its owner membership in one transaction', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(null);
    prisma.organization.create.mockResolvedValue({ id: 'org-new', slug: 'x' });

    await build(prisma).resolveContext(user);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('retries with a new slug when the generated one is taken', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(null);
    prisma.organization.create
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValue({
        id: 'org-new',
        slug: 'ada-lovelaces-workspace-ab12',
      });

    const result = await build(prisma).resolveContext(user);

    expect(result.ok).toBe(true);
    expect(prisma.organization.create).toHaveBeenCalledTimes(2);

    const [first] = prisma.organization.create.mock.calls[0] as [
      { data: { slug: string } },
    ];
    const [second] = prisma.organization.create.mock.calls[1] as [
      { data: { slug: string } },
    ];
    expect(second.data.slug).not.toBe(first.data.slug);
  });

  it('rethrows a failure that is not a slug collision', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(null);
    prisma.organization.create.mockRejectedValue(new Error('connection lost'));

    await expect(build(prisma).resolveContext(user)).rejects.toThrow(
      'connection lost',
    );
  });

  it('honours an explicit organization the caller belongs to', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue({
      organizationId: 'org-2',
      role: 'member',
      organization: { slug: 'other' },
    });

    const result = await build(prisma).resolveContext(user, 'org-2');

    expect(result).toEqual({
      ok: true,
      value: { organizationId: 'org-2', slug: 'other', role: 'member' },
    });
    expect(prisma.orgMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', organizationId: 'org-2' },
      }),
    );
  });

  it('refuses an explicit organization the caller does not belong to', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(null);

    const result = await build(prisma).resolveContext(user, 'org-someone-else');

    expect(result).toEqual({ ok: false, error: 'not-a-member' });
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });
});

describe('OrganizationsService.listForUser', () => {
  it('maps memberships to summaries', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findMany.mockResolvedValue([
      {
        role: 'owner',
        organization: {
          id: 'org-1',
          name: 'Acme',
          slug: 'acme',
          plan: 'gratuito',
        },
      },
    ]);

    await expect(build(prisma).listForUser('user-1')).resolves.toEqual([
      {
        id: 'org-1',
        name: 'Acme',
        slug: 'acme',
        plan: 'gratuito',
        role: 'owner',
      },
    ]);
  });
});

describe('OrganizationsService.getUsage', () => {
  const org = { organizationId: 'org-1', slug: 'acme', role: 'owner' as const };

  it('reports plan limits alongside real member, invite, project and credit counts', async () => {
    const prisma = createPrisma();
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'equipo',
      aiEnabled: true,
      aiCreditsUsed: 12,
      aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
    });
    prisma.orgMember.count.mockResolvedValue(2);
    prisma.orgInvite.count.mockResolvedValue(1);
    prisma.project.count.mockResolvedValue(3);

    const result = await build(prisma).getUsage(
      org,
      new Date('2026-09-23T12:00:00.000Z'),
    );

    expect(result).toEqual({
      plan: 'equipo',
      limits: { members: 10, projects: 5, monthlyAiCredits: 300 },
      members: 2,
      pendingInvites: 1,
      projects: 3,
      aiEnabled: true,
      aiCreditsUsed: 12,
      creditsResetAt: '2026-10-01T00:00:00.000Z',
    });
  });

  it('reports zero used credits without mutating storage once the period has rolled over', async () => {
    const prisma = createPrisma();
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'gratuito',
      aiEnabled: true,
      aiCreditsUsed: 20,
      aiCreditsPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
    });

    const result = await build(prisma).getUsage(
      org,
      new Date('2026-09-23T12:00:00.000Z'),
    );

    expect(result.aiCreditsUsed).toBe(0);
    expect(prisma.organization.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });
});
