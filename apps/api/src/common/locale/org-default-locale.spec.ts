import { resolveOrgDefaultLocale } from './org-default-locale';

interface FakePrisma {
  orgMember: { findFirst: jest.Mock };
}

function createPrisma(owner: { locale: string | null } | null): FakePrisma {
  return {
    orgMember: { findFirst: jest.fn().mockResolvedValue(
      owner === null ? null : { user: owner },
    ) },
  };
}

describe('resolveOrgDefaultLocale', () => {
  it("resolves the earliest-joined owner's locale", async () => {
    const prisma = createPrisma({ locale: 'en' });

    const locale = await resolveOrgDefaultLocale(prisma as never, 'org-1');

    expect(locale).toBe('en');
    expect(prisma.orgMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', role: 'owner' },
        orderBy: { joinedAt: 'asc' },
      }),
    );
  });

  it('falls back to the default locale when the owner has no preference recorded', async () => {
    const prisma = createPrisma({ locale: null });

    const locale = await resolveOrgDefaultLocale(prisma as never, 'org-1');

    expect(locale).toBe('en');
  });

  it('falls back to the default locale when the organization has no owner on record', async () => {
    const prisma = createPrisma(null);

    const locale = await resolveOrgDefaultLocale(prisma as never, 'org-1');

    expect(locale).toBe('en');
  });
});
