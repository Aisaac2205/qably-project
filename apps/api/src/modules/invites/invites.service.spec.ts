import type { Env } from '../../config/env';
import { isErr, isOk } from '../../common/result';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import type { EmailSender, SendEmailInput } from '../mailer/mailer.contracts';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PlanEntitlementsService } from '../organizations/plan-entitlements.service';
import { InvitesService } from './invites.service';

const owner: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'owner',
};
const member: OrgContext = { ...owner, role: 'member' };

const inviter: AuthenticatedUser = {
  id: 'user-owner',
  email: 'owner@acme.test',
  name: 'Ada Lovelace',
  emailVerified: true,
  locale: 'en',
};

const invitee: AuthenticatedUser = {
  id: 'user-invitee',
  email: 'grace@acme.test',
  name: 'Grace Hopper',
  emailVerified: true,
  locale: null,
};

const env = { WEB_APP_URL: 'http://localhost:3000' } as Env;

interface FakePrisma {
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
  orgMember: { findFirst: jest.Mock; upsert: jest.Mock; count: jest.Mock };
  orgInvite: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
  organization: { findUnique: jest.Mock };
  user: { findFirst: jest.Mock };
}

const inviteRow = {
  id: 'invite-1',
  email: 'grace@acme.test',
  role: 'member' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  expiresAt: new Date('2026-01-08T00:00:00.000Z'),
  invitedBy: { name: 'Ada Lovelace' },
};

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ plan: 'equipo' }]),
    $transaction: jest.fn(),
    orgMember: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    orgInvite: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(inviteRow),
      update: jest.fn().mockResolvedValue(inviteRow),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    organization: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Acme' }),
    },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
  );

  return prisma;
}

function createSender(): EmailSender & {
  send: jest.Mock<Promise<void>, [SendEmailInput]>;
} {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function build(prisma: FakePrisma, sender: ReturnType<typeof createSender>) {
  return new InvitesService(
    prisma as never,
    new PlanEntitlementsService(prisma as never),
    sender as never,
    env,
  );
}

describe('InvitesService.createInvite', () => {
  it('refuses to invite when the caller is a plain member', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    const result = await build(prisma, sender).createInvite(member, inviter, {
      email: 'grace@acme.test',
      role: 'member',
    });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(prisma.orgInvite.create).not.toHaveBeenCalled();
  });

  it('locks the organization row and checks the seat allowance before creating', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    await build(prisma, sender).createInvite(owner, inviter, {
      email: 'grace@acme.test',
      role: 'member',
    });

    const lockOrder = prisma.$queryRaw.mock.invocationCallOrder[0];
    const createOrder = prisma.orgInvite.create.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(createOrder);
  });

  it('reports seat-limit-reached without creating an invite once seats are exhausted', async () => {
    const prisma = createPrisma();
    prisma.$queryRaw.mockResolvedValue([{ plan: 'gratuito' }]);
    prisma.orgMember.count.mockResolvedValue(3);
    const sender = createSender();

    const result = await build(prisma, sender).createInvite(owner, inviter, {
      email: 'grace@acme.test',
      role: 'member',
    });

    expect(result).toEqual({ ok: false, error: 'seat-limit-reached' });
    expect(prisma.orgInvite.create).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('refuses to invite an email that already belongs to a member of the organization', async () => {
    const prisma = createPrisma();
    prisma.orgMember.findFirst.mockResolvedValue({ id: 'member-1' });
    const sender = createSender();

    const result = await build(prisma, sender).createInvite(owner, inviter, {
      email: 'grace@acme.test',
      role: 'member',
    });

    expect(result).toEqual({ ok: false, error: 'already-member' });
    expect(prisma.orgInvite.create).not.toHaveBeenCalled();
  });

  it('stores only a sha256 hash of a 32-byte random token, never the raw token', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    await build(prisma, sender).createInvite(owner, inviter, {
      email: 'grace@acme.test',
      role: 'member',
    });

    const [args] = prisma.orgInvite.create.mock.calls[0] as [
      { data: { tokenHash: string } },
    ];
    expect(args.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never returns the raw token in the result', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    const result = await build(prisma, sender).createInvite(owner, inviter, {
      email: 'grace@acme.test',
      role: 'member',
    });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('token');
  });

  it('rotates the token on the existing pending row when the same email is re-invited', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findFirst.mockResolvedValue({ id: 'invite-existing' });
    const sender = createSender();

    await build(prisma, sender).createInvite(owner, inviter, {
      email: 'grace@acme.test',
      role: 'admin',
    });

    expect(prisma.orgInvite.create).not.toHaveBeenCalled();
    const [updateArgs] = prisma.orgInvite.update.mock.calls[0] as [
      { where: { id: string }; data: { role: string } },
    ];
    expect(updateArgs.where).toEqual({ id: 'invite-existing' });
    expect(updateArgs.data.role).toBe('admin');
  });

  it('emails the invite link and reports delivery success', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    const result = await build(prisma, sender).createInvite(owner, inviter, {
      email: 'grace@acme.test',
      role: 'member',
    });

    expect(sender.send).toHaveBeenCalledTimes(1);
    const [call] = sender.send.mock.calls[0];
    expect(call.to).toBe('grace@acme.test');
    expect(call.html).toContain('http://localhost:3000/invite/');
    expect(isOk(result) && result.value.emailDelivered).toBe(true);
  });

  it('still creates the invite and reports emailDelivered:false when the mailer throws', async () => {
    const prisma = createPrisma();
    const sender = createSender();
    sender.send.mockRejectedValue(new Error('resend is down'));

    const result = await build(prisma, sender).createInvite(owner, inviter, {
      email: 'grace@acme.test',
      role: 'member',
    });

    expect(isOk(result) && result.value.emailDelivered).toBe(false);
  });
});

describe('InvitesService.previewInvite', () => {
  it('reports invite-invalid-or-used for a token that matches no invite', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    const result = await build(prisma, sender).previewInvite('unknown-token');

    expect(result).toEqual({ ok: false, error: 'invite-invalid-or-used' });
  });

  it('previews a pending invite without leaking the token', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue({
      email: 'grace@acme.test',
      role: 'member',
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      organization: { name: 'Acme' },
      invitedBy: { name: 'Ada Lovelace' },
    });
    const sender = createSender();

    const result = await build(prisma, sender).previewInvite('some-token');

    expect(result).toEqual({
      ok: true,
      value: {
        organizationName: 'Acme',
        inviterName: 'Ada Lovelace',
        email: 'grace@acme.test',
        role: 'member',
        status: 'pending',
      },
    });
  });

  it('reports status accepted once the invite was already claimed', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue({
      email: 'grace@acme.test',
      role: 'member',
      acceptedAt: new Date('2026-01-01T00:00:00.000Z'),
      revokedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      organization: { name: 'Acme' },
      invitedBy: { name: 'Ada Lovelace' },
    });
    const sender = createSender();

    const result = await build(prisma, sender).previewInvite('some-token');

    expect(isOk(result) && result.value.status).toBe('accepted');
  });

  it('reports status expired once past the expiry date', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue({
      email: 'grace@acme.test',
      role: 'member',
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      organization: { name: 'Acme' },
      invitedBy: { name: 'Ada Lovelace' },
    });
    const sender = createSender();

    const result = await build(prisma, sender).previewInvite('some-token');

    expect(isOk(result) && result.value.status).toBe('expired');
  });
});

describe('InvitesService.acceptInvite', () => {
  function pendingInviteRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'invite-1',
      organizationId: 'org-1',
      email: 'grace@acme.test',
      role: 'member',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
      ...overrides,
    };
  }

  it('reports invite-invalid-or-used for an unknown token', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    const result = await build(prisma, sender).acceptInvite(
      'unknown-token',
      invitee,
    );

    expect(result).toEqual({ ok: false, error: 'invite-invalid-or-used' });
  });

  it('reports invite-invalid-or-used for an invite already accepted', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue(
      pendingInviteRow({ acceptedAt: new Date('2026-01-01T00:00:00.000Z') }),
    );
    const sender = createSender();

    const result = await build(prisma, sender).acceptInvite(
      'some-token',
      invitee,
    );

    expect(result).toEqual({ ok: false, error: 'invite-invalid-or-used' });
    expect(prisma.orgMember.upsert).not.toHaveBeenCalled();
  });

  it('reports invite-invalid-or-used for a revoked invite', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue(
      pendingInviteRow({ revokedAt: new Date('2026-01-01T00:00:00.000Z') }),
    );
    const sender = createSender();

    const result = await build(prisma, sender).acceptInvite(
      'some-token',
      invitee,
    );

    expect(result).toEqual({ ok: false, error: 'invite-invalid-or-used' });
  });

  it('reports invite-expired for a pending invite past its expiry', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue(
      pendingInviteRow({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }),
    );
    const sender = createSender();

    const result = await build(prisma, sender).acceptInvite(
      'some-token',
      invitee,
    );

    expect(result).toEqual({ ok: false, error: 'invite-expired' });
  });

  it('reports invite-email-mismatch when the session email differs from the invite email', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue(pendingInviteRow());
    const sender = createSender();

    const result = await build(prisma, sender).acceptInvite('some-token', {
      ...invitee,
      email: 'someone-else@acme.test',
    });

    expect(result).toEqual({ ok: false, error: 'invite-email-mismatch' });
    expect(prisma.orgMember.upsert).not.toHaveBeenCalled();
  });

  it('matches the invite email case-insensitively', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue(
      pendingInviteRow({ email: 'Grace@Acme.test' }),
    );
    const sender = createSender();

    const result = await build(prisma, sender).acceptInvite('some-token', {
      ...invitee,
      email: 'grace@acme.test',
    });

    expect(isOk(result)).toBe(true);
  });

  it('re-checks the seat allowance under the organization lock before claiming', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue(pendingInviteRow());
    prisma.$queryRaw.mockResolvedValue([{ plan: 'gratuito' }]);
    prisma.orgMember.count.mockResolvedValue(3);
    const sender = createSender();

    const result = await build(prisma, sender).acceptInvite(
      'some-token',
      invitee,
    );

    expect(result).toEqual({ ok: false, error: 'seat-limit-reached' });
    expect(prisma.orgInvite.updateMany).not.toHaveBeenCalled();
  });

  it('claims the invite atomically and reports invite-invalid-or-used if another request already claimed it', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue(pendingInviteRow());
    prisma.orgInvite.updateMany.mockResolvedValue({ count: 0 });
    const sender = createSender();

    const result = await build(prisma, sender).acceptInvite(
      'some-token',
      invitee,
    );

    expect(result).toEqual({ ok: false, error: 'invite-invalid-or-used' });
    expect(prisma.orgMember.upsert).not.toHaveBeenCalled();
  });

  it('claims the invite via a conditional updateMany before creating the membership', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue(pendingInviteRow());
    const sender = createSender();

    const result = await build(prisma, sender).acceptInvite(
      'some-token',
      invitee,
    );

    expect(prisma.orgInvite.updateMany).toHaveBeenCalledWith({
      where: { id: 'invite-1', acceptedAt: null, revokedAt: null },
      data: { acceptedAt: expect.any(Date) as Date },
    });
    expect(prisma.orgMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_userId: {
            organizationId: 'org-1',
            userId: invitee.id,
          },
        },
        create: {
          organizationId: 'org-1',
          userId: invitee.id,
          role: 'member',
        },
      }),
    );
    expect(result).toEqual({ ok: true, value: { organizationId: 'org-1' } });
  });
});

describe('InvitesService.listInvites', () => {
  it('refuses to list invites for a plain member', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    const result = await build(prisma, sender).listInvites(member);

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('lists only pending, unexpired invites for owners and admins', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findMany.mockResolvedValue([inviteRow]);
    const sender = createSender();

    const result = await build(prisma, sender).listInvites(owner);

    expect(isErr(result)).toBe(false);
    const [listArgs] = prisma.orgInvite.findMany.mock.calls[0] as [
      {
        where: {
          organizationId: string;
          acceptedAt: null;
          revokedAt: null;
        };
      },
    ];
    expect(listArgs.where).toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
        acceptedAt: null,
        revokedAt: null,
      }),
    );
  });
});

describe('InvitesService.revokeInvite', () => {
  it('refuses to revoke for a plain member', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    const result = await build(prisma, sender).revokeInvite(member, 'invite-1');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('reports not-found when the invite does not belong to the caller organization', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.updateMany.mockResolvedValue({ count: 0 });
    const sender = createSender();

    const result = await build(prisma, sender).revokeInvite(owner, 'invite-x');

    expect(result).toEqual({ ok: false, error: 'not-found' });
  });

  it('revokes a pending invite scoped to the organization', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    const result = await build(prisma, sender).revokeInvite(owner, 'invite-1');

    expect(prisma.orgInvite.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'invite-1',
        organizationId: 'org-1',
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) as Date },
    });
    expect(result).toEqual({ ok: true, value: undefined });
  });
});

describe('InvitesService.resendInvite', () => {
  it('refuses to resend for a plain member', async () => {
    const prisma = createPrisma();
    const sender = createSender();

    const result = await build(prisma, sender).resendInvite(
      member,
      inviter,
      'invite-1',
    );

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('reports not-found when the invite is no longer pending', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.updateMany.mockResolvedValue({ count: 0 });
    const sender = createSender();

    const result = await build(prisma, sender).resendInvite(
      owner,
      inviter,
      'invite-1',
    );

    expect(result).toEqual({ ok: false, error: 'not-found' });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('rotates the token and re-sends the invite email', async () => {
    const prisma = createPrisma();
    prisma.orgInvite.findUnique.mockResolvedValue(inviteRow);
    const sender = createSender();

    const result = await build(prisma, sender).resendInvite(
      owner,
      inviter,
      'invite-1',
    );

    const [args] = prisma.orgInvite.updateMany.mock.calls[0] as [
      { data: { tokenHash: string } },
    ];
    expect(args.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(isOk(result)).toBe(true);
  });
});
