import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreditSpendClient {
  organization: { updateMany: PrismaService['organization']['updateMany'] };
}

@Injectable()
export class AiEntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async isEntitled(organizationId: string): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { aiEnabled: true, aiCredits: true },
    });

    return (
      organization !== null &&
      organization.aiEnabled &&
      organization.aiCredits > 0
    );
  }

  async spendCredit(
    organizationId: string,
    client: CreditSpendClient = this.prisma,
  ): Promise<boolean> {
    const result = await client.organization.updateMany({
      where: { id: organizationId, aiEnabled: true, aiCredits: { gt: 0 } },
      data: { aiCredits: { decrement: 1 } },
    });

    return result.count > 0;
  }
}
