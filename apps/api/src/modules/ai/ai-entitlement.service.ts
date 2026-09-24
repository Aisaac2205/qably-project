import { Injectable } from '@nestjs/common';
import { PLAN_LIMITS, creditsUsedAt, monthStartUtc } from '@qably/types';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreditSpendClient {
  organization: {
    findUnique: PrismaService['organization']['findUnique'];
    updateMany: PrismaService['organization']['updateMany'];
  };
}

@Injectable()
export class AiEntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async isEntitled(organizationId: string): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        aiEnabled: true,
        aiCreditsUsed: true,
        aiCreditsPeriodStart: true,
      },
    });

    if (organization === null || !organization.aiEnabled) return false;

    const used = creditsUsedAt(organization, new Date());
    const allotment = PLAN_LIMITS[organization.plan].monthlyAiCredits;

    return used < allotment;
  }

  async spendCredit(
    organizationId: string,
    client: CreditSpendClient = this.prisma,
  ): Promise<boolean> {
    const organization = await client.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        aiEnabled: true,
        aiCreditsUsed: true,
        aiCreditsPeriodStart: true,
      },
    });

    if (organization === null || !organization.aiEnabled) return false;

    const now = new Date();
    const monthStart = monthStartUtc(now);

    if (organization.aiCreditsPeriodStart < monthStart) {
      await client.organization.updateMany({
        where: {
          id: organizationId,
          aiCreditsPeriodStart: { lt: monthStart },
        },
        data: { aiCreditsUsed: 0, aiCreditsPeriodStart: monthStart },
      });
    }

    const allotment = PLAN_LIMITS[organization.plan].monthlyAiCredits;
    const used = creditsUsedAt(organization, now);
    if (used >= allotment) return false;

    const result = await client.organization.updateMany({
      where: {
        id: organizationId,
        plan: organization.plan,
        aiEnabled: true,
        aiCreditsUsed: { lt: allotment },
      },
      data: { aiCreditsUsed: { increment: 1 } },
    });

    return result.count > 0;
  }
}
