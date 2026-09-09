import { AiEntitlementService } from './ai-entitlement.service';

interface FakePrisma {
  organization: { findUnique: jest.Mock; updateMany: jest.Mock };
}

function createPrisma(): FakePrisma {
  return {
    organization: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

function build(prisma: FakePrisma): AiEntitlementService {
  return new AiEntitlementService(prisma as never);
}

describe('AiEntitlementService', () => {
  describe('isEntitled', () => {
    it('is true when aiEnabled is true and aiCredits is positive', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        aiEnabled: true,
        aiCredits: 5,
      });

      await expect(build(prisma).isEntitled('org-1')).resolves.toBe(true);
    });

    it('is false when aiEnabled is false', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        aiEnabled: false,
        aiCredits: 5,
      });

      await expect(build(prisma).isEntitled('org-1')).resolves.toBe(false);
    });

    it('is false when aiCredits is zero', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        aiEnabled: true,
        aiCredits: 0,
      });

      await expect(build(prisma).isEntitled('org-1')).resolves.toBe(false);
    });

    it('is false when the organization no longer exists', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(build(prisma).isEntitled('org-1')).resolves.toBe(false);
    });
  });

  describe('spendCredit', () => {
    it('decrements one credit atomically and reports success', async () => {
      const prisma = createPrisma();
      prisma.organization.updateMany.mockResolvedValue({ count: 1 });

      await expect(build(prisma).spendCredit('org-1')).resolves.toBe(true);
      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { id: 'org-1', aiEnabled: true, aiCredits: { gt: 0 } },
        data: { aiCredits: { decrement: 1 } },
      });
    });

    it('reports failure when no row matched (no credits left)', async () => {
      const prisma = createPrisma();
      prisma.organization.updateMany.mockResolvedValue({ count: 0 });

      await expect(build(prisma).spendCredit('org-1')).resolves.toBe(false);
    });

    it('spends the credit through a given transaction client instead of the default connection', async () => {
      const prisma = createPrisma();
      const tx = {
        organization: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };

      await expect(build(prisma).spendCredit('org-1', tx)).resolves.toBe(true);
      expect(tx.organization.updateMany).toHaveBeenCalledWith({
        where: { id: 'org-1', aiEnabled: true, aiCredits: { gt: 0 } },
        data: { aiCredits: { decrement: 1 } },
      });
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });
  });
});
