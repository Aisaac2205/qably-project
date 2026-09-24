import type { OrgContext } from './organizations.contracts';
import { MembersService } from './members.service';
import { PlanEntitlementsService } from './plan-entitlements.service';

const owner: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'owner',
};
const admin: OrgContext = { ...owner, role: 'admin' };
const member: OrgContext = { ...owner, role: 'member' };

interface FakePrisma {
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
  orgMember: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
}

const memberRow = {
  id: 'member-2',
  userId: 'user-2',
  role: 'member' as const,
  joinedAt: new Date('2026-01-01T00:00:00.000Z'),
  user: { name: 'Bob', email: 'bob@acme.test', image: null },
};

const ownerRow = {
  id: 'member-1',
  userId: 'user-1',
  role: 'owner' as const,
  joinedAt: new Date('2026-01-01T00:00:00.000Z'),
  user: {
    name: 'Ada Lovelace',
    email: 'ada@acme.test',
    image: 'https://x/a.png',
  },
};

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ plan: 'equipo' }]),
    $transaction: jest.fn(),
    orgMember: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
  );

  return prisma;
}

function build(prisma: FakePrisma): MembersService {
  return new MembersService(
    prisma as never,
    new PlanEntitlementsService(prisma as never),
  );
}

describe('MembersService.listMembers', () => {
  it('refuses a plain member', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).listMembers(member);

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.orgMember.findMany).not.toHaveBeenCalled();
  });

  it('maps membership rows to OrgMember summaries for an owner', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findMany.mockResolvedValue([ownerRow, memberRow]);

    const result = await build(prisma).listMembers(owner);

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: 'member-1',
          userId: 'user-1',
          name: 'Ada Lovelace',
          email: 'ada@acme.test',
          role: 'owner',
          joinedAt: '2026-01-01T00:00:00.000Z',
          avatarUrl: 'https://x/a.png',
        },
        {
          id: 'member-2',
          userId: 'user-2',
          name: 'Bob',
          email: 'bob@acme.test',
          role: 'member',
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
  });
});

describe('MembersService.changeRole', () => {
  it('refuses a plain member', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).changeRole(member, 'member-2', 'admin');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.orgMember.update).not.toHaveBeenCalled();
  });

  it('locks the organization row before reading the target member', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(memberRow);
    prisma.orgMember.update.mockResolvedValue({ ...memberRow, role: 'admin' });

    await build(prisma).changeRole(owner, 'member-2', 'admin');

    const lockOrder = prisma.$queryRaw.mock.invocationCallOrder[0];
    const readOrder = prisma.orgMember.findFirst.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(readOrder);
  });

  it('reports not-found for a member outside the caller organization', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(null);

    const result = await build(prisma).changeRole(owner, 'member-x', 'admin');

    expect(result).toEqual({ ok: false, error: 'not-found' });
  });

  it('refuses an admin promoting a member to owner', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(memberRow);

    const result = await build(prisma).changeRole(admin, 'member-2', 'owner');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.orgMember.update).not.toHaveBeenCalled();
  });

  it('refuses an admin demoting an owner', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(ownerRow);
    prisma.orgMember.count.mockResolvedValue(2);

    const result = await build(prisma).changeRole(admin, 'member-1', 'admin');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.orgMember.update).not.toHaveBeenCalled();
  });

  it('allows an owner to promote a member to owner', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(memberRow);
    prisma.orgMember.update.mockResolvedValue({ ...memberRow, role: 'owner' });

    const result = await build(prisma).changeRole(owner, 'member-2', 'owner');

    expect(result).toEqual({
      ok: true,
      value: {
        id: 'member-2',
        userId: 'user-2',
        name: 'Bob',
        email: 'bob@acme.test',
        role: 'owner',
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('reports last-owner-required when demoting the sole owner', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(ownerRow);
    prisma.orgMember.count.mockResolvedValue(1);

    const result = await build(prisma).changeRole(owner, 'member-1', 'admin');

    expect(result).toEqual({ ok: false, error: 'last-owner-required' });
    expect(prisma.orgMember.update).not.toHaveBeenCalled();
  });

  it('allows an owner to demote another owner when a second owner remains', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(ownerRow);
    prisma.orgMember.count.mockResolvedValue(2);
    prisma.orgMember.update.mockResolvedValue({ ...ownerRow, role: 'admin' });

    const result = await build(prisma).changeRole(owner, 'member-1', 'admin');

    expect(result.ok).toBe(true);
    expect(prisma.orgMember.update).toHaveBeenCalledTimes(1);
  });

  it('allows an admin to change a member role that does not touch ownership', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(memberRow);
    prisma.orgMember.update.mockResolvedValue({ ...memberRow, role: 'admin' });

    const result = await build(prisma).changeRole(admin, 'member-2', 'admin');

    expect(result.ok).toBe(true);
  });
});

describe('MembersService.removeMember', () => {
  it('refuses a plain member', async () => {
    const prisma = createPrisma();

    const result = await build(prisma).removeMember(member, 'member-2');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.orgMember.delete).not.toHaveBeenCalled();
  });

  it('reports not-found for a member outside the caller organization', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(null);

    const result = await build(prisma).removeMember(owner, 'member-x');

    expect(result).toEqual({ ok: false, error: 'not-found' });
  });

  it('refuses an admin removing an owner', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(ownerRow);
    prisma.orgMember.count.mockResolvedValue(2);

    const result = await build(prisma).removeMember(admin, 'member-1');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.orgMember.delete).not.toHaveBeenCalled();
  });

  it('reports last-owner-required when removing the sole owner', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(ownerRow);
    prisma.orgMember.count.mockResolvedValue(1);

    const result = await build(prisma).removeMember(owner, 'member-1');

    expect(result).toEqual({ ok: false, error: 'last-owner-required' });
    expect(prisma.orgMember.delete).not.toHaveBeenCalled();
  });

  it('allows an owner to remove another owner when a second owner remains', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(ownerRow);
    prisma.orgMember.count.mockResolvedValue(2);

    const result = await build(prisma).removeMember(owner, 'member-1');

    expect(result).toEqual({ ok: true, value: undefined });
    expect(prisma.orgMember.delete).toHaveBeenCalledWith({
      where: { id: 'member-1' },
    });
  });

  it('allows an admin to remove a plain member', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue(memberRow);

    const result = await build(prisma).removeMember(admin, 'member-2');

    expect(result).toEqual({ ok: true, value: undefined });
  });
});
