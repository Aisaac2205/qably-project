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
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-23T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isEntitled', () => {
    it('is true when aiEnabled is true and the plan still has credits this period', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        plan: 'equipo',
        aiEnabled: true,
        aiCreditsUsed: 5,
        aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
      });

      await expect(build(prisma).isEntitled('org-1')).resolves.toBe(true);
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it('is false when aiEnabled is false', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        plan: 'equipo',
        aiEnabled: false,
        aiCreditsUsed: 5,
        aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
      });

      await expect(build(prisma).isEntitled('org-1')).resolves.toBe(false);
    });

    it('is false when the plan allotment for this period is exhausted', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        plan: 'gratuito',
        aiEnabled: true,
        aiCreditsUsed: 25,
        aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
      });

      await expect(build(prisma).isEntitled('org-1')).resolves.toBe(false);
    });

    it('is true when the stored period already elapsed, without writing the rollover', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        plan: 'gratuito',
        aiEnabled: true,
        aiCreditsUsed: 25,
        aiCreditsPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
      });

      await expect(build(prisma).isEntitled('org-1')).resolves.toBe(true);
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it('is false when the organization no longer exists', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(build(prisma).isEntitled('org-1')).resolves.toBe(false);
    });
  });

  describe('spendCredit', () => {
    it('rolls the period over lazily before spending when it elapsed', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        plan: 'equipo',
        aiEnabled: true,
        aiCreditsUsed: 300,
        aiCreditsPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
      });
      prisma.organization.updateMany.mockResolvedValue({ count: 1 });

      await expect(build(prisma).spendCredit('org-1')).resolves.toBe(true);

      expect(prisma.organization.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: 'org-1',
          aiCreditsPeriodStart: { lt: new Date('2026-09-01T00:00:00.000Z') },
        },
        data: {
          aiCreditsUsed: 0,
          aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
        },
      });
      expect(prisma.organization.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: 'org-1',
          plan: 'equipo',
          aiEnabled: true,
          aiCreditsUsed: { lt: 300 },
        },
        data: { aiCreditsUsed: { increment: 1 } },
      });
    });

    it('skips the rollover write when the current period is still active', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        plan: 'equipo',
        aiEnabled: true,
        aiCreditsUsed: 5,
        aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
      });
      prisma.organization.updateMany.mockResolvedValue({ count: 1 });

      await expect(build(prisma).spendCredit('org-1')).resolves.toBe(true);

      expect(prisma.organization.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'org-1',
          plan: 'equipo',
          aiEnabled: true,
          aiCreditsUsed: { lt: 300 },
        },
        data: { aiCreditsUsed: { increment: 1 } },
      });
    });

    it('reports failure when the atomic spend matched no row', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        plan: 'equipo',
        aiEnabled: true,
        aiCreditsUsed: 5,
        aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
      });
      prisma.organization.updateMany.mockResolvedValue({ count: 0 });

      await expect(build(prisma).spendCredit('org-1')).resolves.toBe(false);
    });

    it('reports failure without writing when the period allotment is already exhausted', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        plan: 'gratuito',
        aiEnabled: true,
        aiCreditsUsed: 25,
        aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
      });

      await expect(build(prisma).spendCredit('org-1')).resolves.toBe(false);
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it('reports failure when the organization has AI disabled', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue({
        plan: 'equipo',
        aiEnabled: false,
        aiCreditsUsed: 5,
        aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
      });

      await expect(build(prisma).spendCredit('org-1')).resolves.toBe(false);
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it('reports failure when the organization no longer exists', async () => {
      const prisma = createPrisma();
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(build(prisma).spendCredit('org-1')).resolves.toBe(false);
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it('reads and spends the credit through a given transaction client instead of the default connection', async () => {
      const prisma = createPrisma();
      const tx = {
        organization: {
          findUnique: jest.fn().mockResolvedValue({
            plan: 'equipo',
            aiEnabled: true,
            aiCreditsUsed: 5,
            aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      await expect(build(prisma).spendCredit('org-1', tx)).resolves.toBe(true);
      expect(tx.organization.findUnique).toHaveBeenCalled();
      expect(tx.organization.updateMany).toHaveBeenCalled();
      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });
  });
});
