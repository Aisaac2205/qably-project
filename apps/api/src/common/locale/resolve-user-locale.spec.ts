import { resolveUserLocale } from './resolve-user-locale';

interface FakePrisma {
  user: { findUnique: jest.Mock };
}

function createPrisma(locale: string | null | undefined): FakePrisma {
  return {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(locale === undefined ? null : { locale }),
    },
  };
}

describe('resolveUserLocale', () => {
  it("resolves the given user's recorded locale", async () => {
    const prisma = createPrisma('es');

    const locale = await resolveUserLocale(prisma as never, 'user-1');

    expect(locale).toBe('es');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { locale: true },
    });
  });

  it('falls back to the default locale when the user has no preference recorded', async () => {
    const prisma = createPrisma(null);

    const locale = await resolveUserLocale(prisma as never, 'user-1');

    expect(locale).toBe('en');
  });

  it('falls back to the default locale when the user is not found', async () => {
    const prisma = createPrisma(undefined);

    const locale = await resolveUserLocale(prisma as never, 'user-1');

    expect(locale).toBe('en');
  });
});
