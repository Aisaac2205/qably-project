import type { AuthenticatedUser } from '../auth/auth.contracts';
import { OrganizationsService } from './organizations.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'ada@acme.test',
  name: 'Ada Lovelace',
  emailVerified: true,
};

interface FakePrisma {
  orgMember: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
  organization: { create: jest.Mock };
  $transaction: jest.Mock;
}

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    orgMember: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    organization: { create: jest.fn() },
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
