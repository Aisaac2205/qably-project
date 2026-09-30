import { AiEntitlementService } from './ai-entitlement.service';

function createPrisma(plan: string | null) {
  return {
    organization: {
      findUnique: jest.fn().mockResolvedValue(plan === null ? null : { plan }),
      updateMany: jest.fn(),
    },
  };
}

describe('AiEntitlementService.maxSourceCharacters', () => {
  it.each([
    ['gratuito', 60_000],
    ['equipo', 60_000],
    ['empresa', 1_000_000],
  ])('resolves the %s plan to %i characters', async (plan, expected) => {
    const prisma = createPrisma(plan);

    await expect(
      new AiEntitlementService(prisma as never).maxSourceCharacters('org-1'),
    ).resolves.toBe(expected);
  });

  it('falls back to the smallest plan limit when the organization no longer exists', async () => {
    const prisma = createPrisma(null);

    await expect(
      new AiEntitlementService(prisma as never).maxSourceCharacters('org-1'),
    ).resolves.toBe(60_000);
  });

  it('reads only the plan, with a plain lookup that takes no lock and writes nothing', async () => {
    const prisma = createPrisma('empresa');

    await new AiEntitlementService(prisma as never).maxSourceCharacters(
      'org-1',
    );

    expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      select: { plan: true },
    });
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
  });
});
